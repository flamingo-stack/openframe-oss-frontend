/**
 * Native-shell login: runs the gateway BFF OAuth flow in a shell-owned browser
 * context, receives the dev-ticket on the callback, exchanges it natively, and
 * puts the tokens in the Keychain. On mobile the browser is an
 * ASWebAuthenticationSession completing on the app's custom scheme (Google
 * blocks OAuth in embedded webviews — 403 disallowed_useragent); on desktop it
 * is a shell-owned window that cancels the navigation to that same scheme and
 * reads the ticket off it. Either way the gateway 302s the devTicket straight
 * to the scheme, which only an `authMobile=true` login gets. Hardening still
 * pending on the ticket path (PKCE, POST exchange, rotation).
 */
import { authApiClient } from './auth-api-client';
import { type NativeAuthPlugin, nativeAuthPlugin, storeTenantHost } from './native-shell';
import { mobilePlatform } from './platform';
import { runtimeEnv } from './runtime-config';
import { setTokens } from './token-store';

/**
 * Thrown when a browser-flow SSO identity has no OpenFrame account yet. Carries the ticket that
 * names the pending identity server-side, so the app can collect the organization on its own screen
 * and complete without a second trip through the provider.
 */
export class SsoRegistrationRequiredError extends Error {
  readonly signupTicket: string;
  constructor(signupTicket: string) {
    super('SSO_REGISTRATION_REQUIRED');
    this.name = 'SsoRegistrationRequiredError';
    this.signupTicket = signupTicket;
  }
}

/**
 * Thrown when a verified Apple identity has no OpenFrame account. Carries the credential so the
 * signup screen can call `/oauth/apple/native-register` with it — Apple's authorization code is
 * single-use, but the discovery leg never redeems it, so it is still spendable exactly once.
 */
export class AppleRegistrationRequiredError extends Error {
  readonly credential: AppleCredential;
  constructor(credential: AppleCredential) {
    super('APPLE_REGISTRATION_REQUIRED');
    this.name = 'AppleRegistrationRequiredError';
    this.credential = credential;
  }
}

/**
 * A failed native Apple signup, carrying whether Apple's single-use authorization code was
 * consumed. When it was not, the screen can stay up and accept another submit; when it was, the
 * only way forward is a fresh trip through the Apple sheet.
 */
export class AppleRegisterError extends Error {
  readonly credentialSpent: boolean;
  constructor(message: string, credentialSpent: boolean) {
    super(message);
    this.name = 'AppleRegisterError';
    this.credentialSpent = credentialSpent;
  }
}

export interface NativeLoginResult {
  /**
   * True when the callback landed on a different host than the one the app
   * booted with (first login of a host-less build, or a tenant change). The
   * learned host is already persisted, but module-level state may still hold
   * the old value — callers should do a full navigation instead of an SPA
   * route so every client re-initializes against the new host.
   */
  tenantHostChanged: boolean;
}

export async function nativeLogin(options: {
  /** Omit when discovery has not run — the flow resolves the tenant from the asserted identity. */
  tenantId?: string;
  provider?: string;
  tenantDomain?: string;
}): Promise<NativeLoginResult> {
  const plugin = nativeAuthPlugin();
  if (!plugin) {
    throw new Error('Native auth plugin unavailable');
  }

  const discoveredHost = options.tenantDomain ? tenantOrigin(options.tenantDomain) : '';
  const bootHost = runtimeEnv.tenantHostUrl();
  // With no tenant the shared host runs the flow and the callback tells us which gateway we
  // landed on, so an absent tenant host is only fatal when a tenant WAS resolved.
  const tenantHost = discoveredHost || bootHost || runtimeEnv.sharedHostUrl();
  // Whether `tenantHost` is a real tenant gateway FOR THIS sign-in. On the identity-first path it
  // is only the shared host standing in so the flow can RUN — that host is the authorization
  // server, not the tenant's gateway, and persisting it as one points every later data call at the
  // wrong origin. Deliberately NOT `bootHost`: that falls back to the host learned at a previous
  // login, which nothing ever clears, so it would read as "known" while naming another tenant.
  const tenantHostKnown = Boolean(discoveredHost || runtimeEnv.pinnedTenantHostUrl());
  if (!tenantHost) {
    throw new Error(
      'No tenant host available — discovery returned no domain and NEXT_PUBLIC_TENANT_HOST_URL is not configured',
    );
  }

  // Apple on the iOS shell: the native Sign in with Apple sheet
  // (ASAuthorizationController) instead of the browser session — App Store
  // guideline 4.8's preferred form, and no web page involved. Feature-checked:
  // older installed binaries lack the plugin methods and keep the browser path.
  if (options.provider === 'apple' && mobilePlatform() === 'ios' && plugin.signInWithApple && plugin.exchangeApple) {
    return appleNativeLogin(plugin, { tenantId: options.tenantId, tenantHost, bootHost, tenantHostKnown });
  }

  const appScheme = runtimeEnv.appScheme();

  // Both shells complete on the app's custom scheme, and both ask for
  // authMobile=true. Two gateway behaviours hang off that pair, and a native
  // login needs both: `authMobile` is what makes the callback carry a devTicket
  // at all where dev-ticket issuance is off (prod), and the scheme is the only
  // redirect target the gateway honours verbatim in every environment
  // (`openframe.gateway.redirect.allowed-uris`) — an https redirectTo is
  // rewritten to the tenant root. redirectTarget must reach the gateway —
  // start() below resolves on nothing else — so loginUrl keeps it for any
  // shell, saas-shared included.
  const redirectTarget = `${appScheme}://auth`;
  // Tenant known: use its own SSO configuration. Tenant unknown: the shared onboarding flow, which
  // resolves the tenant from the identity the provider asserts.
  const rawLoginUrl = options.tenantId
    ? authApiClient.loginUrl(options.tenantId, encodeURIComponent(redirectTarget), options.provider, {
        authMobile: true,
      })
    : authApiClient.ssoLoginUrl(options.provider ?? 'openframe', {
        redirectTo: redirectTarget,
        authMobile: true,
      });
  const loginUrl = rawLoginUrl.startsWith('http') ? rawLoginUrl : `${tenantHost}${rawLoginUrl}`;

  const { callbackUrl: resultUrl } = await plugin.start({ url: loginUrl, callbackScheme: appScheme });

  return completeTicketFlow(plugin, resultUrl, {
    tenantHost,
    bootHost,
    tenantHostKnown,
    // The gateway issues one for an authMobile login regardless of its
    // dev-ticket setting, so a callback without one means the login never
    // reached the BFF callback, or `mobile-auth-enabled` is off on the gateway.
    noTicketMessage: 'Login completed without a ticket — is mobile auth enabled on the gateway?',
  });
}

const UNKNOWN_TENANT_HOST_MESSAGE =
  'Could not determine your organization’s host. Enter your email address and try again.';

/** A string claim off an unverified JWT payload, or null if absent or unreadable. */
function readJwtClaim(token: string | null | undefined, claim: string): string | null {
  if (!token) return null;
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')));
    return typeof decoded?.[claim] === 'string' ? decoded[claim] : null;
  } catch {
    return null;
  }
}

/**
 * The address Apple asserted, read off the identity token so the signup screen can show who is
 * signing up — the same thing the ticket flow shows. For a Hide My Email user this is the relay,
 * which is genuinely the address on the account. Display only: the gateway reads the address from
 * the VERIFIED token, never from anything the app sends.
 */
export function appleIdentityEmail(credential: AppleCredential): string | undefined {
  return readJwtClaim(credential.identityToken, 'email') ?? undefined;
}

/**
 * The tenant gateway, recovered from the tokens the flow just issued.
 *
 * The identity-first flow never names the tenant: nothing was typed, so discovery never ran, and the
 * callback carries a ticket rather than a host. But the access token does carry the account — `sub`
 * is its email — and discovery answers with the canonical `domain` for it. That is the same value
 * the email-first path would have learned, just fetched after authenticating instead of before.
 *
 * Costs one request, and only on the path that would otherwise have to fail.
 */
async function learnTenantHostFromToken(accessToken?: string | null): Promise<string> {
  const email = readJwtClaim(accessToken, 'sub');
  if (!email) return '';
  try {
    const res = await authApiClient.discoverTenants(email);
    const domain = res.ok ? (res.data as { domain?: string } | undefined)?.domain : undefined;
    // 'localhost' is discovery's answer for a single-tenant dev backend, not a reachable gateway.
    return domain && domain !== 'localhost' ? new URL(tenantOrigin(domain)).origin : '';
  } catch {
    return '';
  }
}

/** Trailing slashes off, so `${base}/path` cannot produce the `//path` the shell's path pin rejects. */
function trimBase(base: string): string {
  return base.replace(/\/+$/, '');
}

/** A tenant domain as an origin — the field is sometimes stored bare, sometimes with the scheme. */
function tenantOrigin(domain: string): string {
  return domain.startsWith('http') ? domain : `https://${domain}`;
}

/** Persist the gateway origin on both sides: the web layer, and the shell's own networking. */
async function persistTenantHost(plugin: NativeAuthPlugin, origin: string): Promise<void> {
  storeTenantHost(origin);
  try {
    await plugin.setTenantHost?.({ origin });
  } catch {
    // Optional capability — older shells don't implement it.
  }
}

/**
 * Shared tail of both dev-ticket flows: take the ticket off the callback URL,
 * exchange it natively, store the tokens, and learn the tenant host.
 */
async function completeTicketFlow(
  plugin: NativeAuthPlugin,
  resultUrl: string,
  options: { tenantHost: string; bootHost: string; noTicketMessage: string; tenantHostKnown: boolean },
): Promise<NativeLoginResult> {
  const { tenantHost, bootHost } = options;
  const parsedResult = new URL(resultUrl);

  // The provider authenticated someone with no account yet. The identity stays server-side; this
  // ticket is the handle to it, and the app finishes the signup on its own screen rather than
  // leaving the user in a browser sheet that cannot hand control back.
  const signupTicket = parsedResult.searchParams.get('signupTicket');
  if (signupTicket) {
    throw new SsoRegistrationRequiredError(signupTicket);
  }

  const ticket = parsedResult.searchParams.get('devTicket');
  if (!ticket) {
    throw new Error(options.noTicketMessage);
  }

  // The scheme callback carries no host — the discovery-resolved tenant host is
  // the gateway (the backend guarantees discovery `domain` is the exact
  // canonical tenant host; at signup it is the domain just registered). An https
  // callback still happens where the gateway drops the requested redirect and
  // puts the ticket on the tenant landing instead; that origin is
  // TLS-authenticated, so take it as-is.
  const callbackHost =
    parsedResult.protocol === 'https:'
      ? parsedResult.origin
      : options.tenantHostKnown
        ? new URL(tenantHost).origin
        : '';

  const exchangeBase = trimBase(runtimeEnv.sharedHostUrl() || tenantHost);
  const { accessToken, refreshToken } = await plugin.exchangeTicket({
    url: `${exchangeBase}/oauth/dev-exchange?ticket=${encodeURIComponent(ticket)}`,
  });

  if (!accessToken && !refreshToken) {
    throw new Error('Ticket exchange returned no tokens');
  }

  // Nothing in an identity-first flow named the tenant, so fall back to the account the tokens
  // identify. Done before `setTokens`: a session that cannot reach its gateway should not be
  // written to the Keychain and broadcast, only to be cleared again.
  const learnedHost = callbackHost || (await learnTenantHostFromToken(accessToken));
  if (!learnedHost) {
    throw new Error(UNKNOWN_TENANT_HOST_MESSAGE);
  }

  await setTokens({ accessToken, refreshToken });
  await persistTenantHost(plugin, learnedHost);

  return { tenantHostChanged: learnedHost !== bootHost.replace(/\/$/, '') };
}

/**
 * Native Sign in with Apple: the ASAuthorizationController sheet returns the
 * Apple credential straight to the shell (no browser, no dev-ticket), and the
 * gateway BFF's `/oauth/apple/native-exchange` swaps it for OpenFrame tokens.
 *
 * Nonce contract: the SHA-256 hex of a fresh raw nonce goes into the Apple
 * request (Apple bakes it into the identity token's `nonce` claim); the RAW
 * nonce goes to the BFF, which re-hashes and compares — binding the token to
 * exactly this sign-in attempt.
 */
async function appleNativeLogin(
  plugin: NativeAuthPlugin,
  options: { tenantId?: string; tenantHost: string; bootHost: string; tenantHostKnown: boolean },
): Promise<NativeLoginResult> {
  const rawNonce = generateNonce();
  const credential = await plugin.signInWithApple?.({ nonce: await sha256Hex(rawNonce) });
  if (!credential?.identityToken || !credential.authorizationCode) {
    throw new Error('Apple sign-in returned no credential');
  }

  const exchangeBase = trimBase(runtimeEnv.sharedHostUrl() || options.tenantHost);
  // tenantId is optional. Omitting it makes the gateway resolve the tenant from the VERIFIED
  // identity token, which is the only route for a Hide My Email user — they never see their relay
  // address, so they cannot go through email discovery to learn a tenant in the first place.
  const tokens = await plugin.exchangeApple?.({
    url: `${exchangeBase}/oauth/apple/native-exchange`,
    body: {
      ...(options.tenantId ? { tenantId: options.tenantId } : {}),
      identityToken: credential.identityToken,
      authorizationCode: credential.authorizationCode,
      nonce: rawNonce,
      // Apple sends the name only on the very first authorization — forward it
      // so the backend can persist it (later logins come back nameless).
      ...(credential.firstName ? { firstName: credential.firstName } : {}),
      ...(credential.lastName ? { lastName: credential.lastName } : {}),
    },
  });

  // 409 registration_required is not a failure: the identity verified, it just has no account.
  // Hand the caller everything needed to finish signup without a second trip through the Apple
  // sheet — the authorization code is single-use but discovery never spends it, so native-register
  // can still redeem it.
  if (tokens?.status === 409 && parseErrorCode(tokens.body) === 'registration_required') {
    throw new AppleRegistrationRequiredError({
      identityToken: credential.identityToken,
      authorizationCode: credential.authorizationCode,
      nonce: rawNonce,
      firstName: credential.firstName,
      lastName: credential.lastName,
    });
  }

  if (!tokens?.accessToken && !tokens?.refreshToken) {
    // A shell that reports status gives a specific reason; an older one that rejected on non-2xx
    // never reaches here at all. A 401 is the gateway's catch-all and carries no body — with the
    // no-account case now answered by 409, it means the token failed verification or the account
    // is inactive, so say that rather than surfacing a bare status the way App Review saw.
    throw new Error(
      !tokens?.status
        ? 'Apple sign-in exchange returned no tokens'
        : appleErrorMessage(
            tokens.status === 401
              ? 'Apple could not sign you in. If your account was deactivated, contact your administrator.'
              : 'Apple could not sign you in. Please try again.',
            tokens.body,
          ),
    );
  }

  // No callback URL to learn a host from. With a discovery-resolved tenant, `tenantHost` IS the
  // gateway (the same guarantee the scheme-callback path relies on). On the identity-first path it
  // is only the shared host standing in — so recover the real one from the token just issued.
  //
  // Resolved BEFORE the tokens are stored: writing them to the Keychain and broadcasting a token
  // change, only to clear both again, leaves every subscriber to reconcile a session that never was.
  const learnedHost = options.tenantHostKnown
    ? new URL(options.tenantHost).origin
    : await learnTenantHostFromToken(tokens.accessToken);
  if (!learnedHost) {
    throw new Error(UNKNOWN_TENANT_HOST_MESSAGE);
  }

  await setTokens({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
  await persistTenantHost(plugin, learnedHost);

  return { tenantHostChanged: learnedHost !== options.bootHost.replace(/\/$/, '') };
}

/**
 * Fully native Apple signup: creates the tenant for a verified Apple identity and signs in with the
 * SAME authorization code in one request. Only reachable after {@link AppleRegistrationRequiredError}.
 *
 * The gateway answers 204 with Access-Token / Refresh-Token headers on success, and
 * 400 {"error": …} otherwise, where the value is a machine code (`account_exists`) for some cases
 * and a human sentence for others — a taken domain arrives as prose, not a code.
 */
export async function appleNativeRegister(options: {
  credential: AppleCredential;
  tenantName: string;
  tenantDomain: string;
}): Promise<void> {
  const plugin = nativeAuthPlugin();
  if (!plugin?.exchangeApple) {
    throw new Error('This app version cannot complete Apple signup. Please update.');
  }
  const base = trimBase(runtimeEnv.sharedHostUrl());
  if (!base) {
    throw new Error('No shared host configured');
  }

  const result = await plugin.exchangeApple({
    url: `${base}/oauth/apple/native-register`,
    body: {
      identityToken: options.credential.identityToken,
      authorizationCode: options.credential.authorizationCode,
      nonce: options.credential.nonce,
      tenantName: options.tenantName,
      tenantDomain: options.tenantDomain,
      ...(options.credential.firstName ? { firstName: options.credential.firstName } : {}),
      ...(options.credential.lastName ? { lastName: options.credential.lastName } : {}),
    },
  });

  if (!result?.accessToken && !result?.refreshToken) {
    // Two legs, and only the second one redeems the authorization code. The gateway creates the
    // tenant first and reports its failures (a taken domain, `account_exists`) as 400 with a body;
    // the code is still unspent then, so the caller can let the user correct the domain and
    // resubmit rather than sending them back through the Apple sheet. Anything else — the exchange
    // leg, or a transport failure with no status — is treated as spent, which is the safe default.
    throw new AppleRegisterError(
      appleErrorMessage("Couldn't finish creating your organization. Please try again.", result?.body),
      result?.status !== 400,
    );
  }

  await setTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken });

  // The tenant was created from `tenantDomain` in this same request, so unlike the exchange the
  // gateway host is known here. Every other native path persists it; without this the app lands on
  // the dashboard with no tenant host and resolves API calls relative to capacitor://localhost.
  const learnedHost = new URL(tenantOrigin(options.tenantDomain)).origin;
  await persistTenantHost(plugin, learnedHost);
}

/**
 * Finishes a browser-flow SSO signup from inside the app.
 *
 * The organization details are POSTed with the ticket that names the pending identity, and the
 * server answers with a devTicket — so completion runs through the same `/oauth/dev-exchange` the
 * shell already uses for login, and no new native surface is needed. The tenant host comes from the
 * domain just submitted, exactly as it does for the native Apple signup.
 */
export async function completeNativeSsoSignup(options: {
  ticket: string;
  tenantName: string;
  tenantDomain: string;
}): Promise<void> {
  const plugin = nativeAuthPlugin();
  if (!plugin) {
    throw new Error('Native auth plugin unavailable');
  }

  const res = await authApiClient.completeSsoRegistrationByTicket(options);
  const body = res.data as { devTicket?: string; error?: string } | undefined;
  if (!res.ok || !body?.devTicket) {
    // A 400 carries the actual reason ("This domain is already in use…") and is correctable in the
    // form; `requestPublic` only synthesises a status line, so read the body before falling back.
    throw new Error(
      (typeof body?.error === 'string' && body.error) ||
        'Could not finish creating your organization. Please try again.',
    );
  }
  const devTicket = body.devTicket;

  const exchangeBase = trimBase(runtimeEnv.sharedHostUrl());
  const { accessToken, refreshToken } = await plugin.exchangeTicket({
    url: `${exchangeBase}/oauth/dev-exchange?ticket=${encodeURIComponent(devTicket)}`,
  });
  if (!accessToken && !refreshToken) {
    throw new Error('Ticket exchange returned no tokens');
  }

  await setTokens({ accessToken, refreshToken });
  await persistTenantHost(plugin, new URL(tenantOrigin(options.tenantDomain)).origin);
}

/**
 * A verified SSO identity that has no OpenFrame account yet, in whichever form the flow handed it
 * back: Apple's native sheet returns the credential itself, the browser flows return a ticket that
 * names the identity server-side. Both are memory-only and both complete without a second trip
 * through the provider.
 */
export type PendingSsoSignup = { kind: 'apple'; credential: AppleCredential } | { kind: 'ticket'; ticket: string };

export interface AppleCredential {
  identityToken: string;
  authorizationCode: string;
  nonce: string;
  firstName?: string;
  lastName?: string;
}

/**
 * Copy for the machine codes the gateway actually emits.
 *
 * The `error` field is not always a code: `OAuthBffService` falls back to the upstream `message`,
 * which is a human sentence when the service runs with `server.error.include-message=always` and an
 * empty string otherwise. Interpolating it produced things like "Apple signup failed (Conflict)" —
 * the same shape of message App Review objected to. So only known codes get spelled out, and
 * anything else falls back to fixed copy.
 */
const APPLE_ERROR_COPY: Record<string, string> = {
  account_exists: 'An account already exists for this Apple ID. Sign in instead.',
};

function appleErrorMessage(fallback: string, body?: string): string {
  const code = parseErrorCode(body);
  // `hasOwn`, not a bare lookup: the code comes off the wire, and `toString`/`constructor` would
  // otherwise resolve up the prototype chain and put a function where the copy should be.
  return (code && Object.hasOwn(APPLE_ERROR_COPY, code) && APPLE_ERROR_COPY[code]) || fallback;
}

/** The gateway's 4xx bodies are `{"error": "..."}`; anything else is not a code we act on. */
function parseErrorCode(body?: string): string | undefined {
  if (!body) return undefined;
  try {
    const parsed = JSON.parse(body);
    return typeof parsed?.error === 'string' ? parsed.error : undefined;
  } catch {
    return undefined;
  }
}

function generateNonce(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
