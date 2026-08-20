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
  tenantId: string;
  provider?: string;
  tenantDomain?: string;
}): Promise<NativeLoginResult> {
  const plugin = nativeAuthPlugin();
  if (!plugin) {
    throw new Error('Native auth plugin unavailable');
  }

  const discoveredHost = options.tenantDomain
    ? options.tenantDomain.startsWith('http')
      ? options.tenantDomain
      : `https://${options.tenantDomain}`
    : '';
  const bootHost = runtimeEnv.tenantHostUrl();
  const tenantHost = discoveredHost || bootHost;
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
    return appleNativeLogin(plugin, { tenantId: options.tenantId, tenantHost, bootHost });
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
  const rawLoginUrl = authApiClient.loginUrl(options.tenantId, encodeURIComponent(redirectTarget), options.provider, {
    authMobile: true,
  });
  const loginUrl = rawLoginUrl.startsWith('http') ? rawLoginUrl : `${tenantHost}${rawLoginUrl}`;

  const { callbackUrl: resultUrl } = await plugin.start({ url: loginUrl, callbackScheme: appScheme });

  const parsedResult = new URL(resultUrl);
  const ticket = parsedResult.searchParams.get('devTicket');
  if (!ticket) {
    // The gateway issues one for an authMobile login regardless of its
    // dev-ticket setting, so a callback without one means the login never
    // reached the BFF callback, or `mobile-auth-enabled` is off on the gateway.
    throw new Error('Login completed without a ticket — is mobile auth enabled on the gateway?');
  }

  const exchangeBase = runtimeEnv.sharedHostUrl() || tenantHost;
  const { accessToken, refreshToken } = await plugin.exchangeTicket({
    url: `${exchangeBase}/oauth/dev-exchange?ticket=${encodeURIComponent(ticket)}`,
  });

  if (!accessToken && !refreshToken) {
    throw new Error('Ticket exchange returned no tokens');
  }

  await setTokens({ accessToken, refreshToken });

  // The scheme callback carries no host — the discovery-resolved tenant host is
  // the gateway (the backend guarantees discovery `domain` is the exact
  // canonical tenant host). An https callback still happens where the gateway
  // drops the requested redirect and puts the ticket on the tenant landing
  // instead; that origin is TLS-authenticated, so take it as-is.
  const learnedHost = parsedResult.protocol === 'https:' ? parsedResult.origin : new URL(tenantHost).origin;
  storeTenantHost(learnedHost);
  // Also persist it shell-side: the shell refreshes tokens (and later runs
  // background NATS) with its own networking, which must not depend on
  // webview localStorage.
  try {
    await plugin.setTenantHost?.({ origin: learnedHost });
  } catch {
    // Optional capability — older shells (mobile) don't implement it.
  }

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
  options: { tenantId: string; tenantHost: string; bootHost: string },
): Promise<NativeLoginResult> {
  const rawNonce = generateNonce();
  const credential = await plugin.signInWithApple?.({ nonce: await sha256Hex(rawNonce) });
  if (!credential?.identityToken || !credential.authorizationCode) {
    throw new Error('Apple sign-in returned no credential');
  }

  const exchangeBase = runtimeEnv.sharedHostUrl() || options.tenantHost;
  const tokens = await plugin.exchangeApple?.({
    url: `${exchangeBase}/oauth/apple/native-exchange`,
    body: {
      tenantId: options.tenantId,
      identityToken: credential.identityToken,
      authorizationCode: credential.authorizationCode,
      nonce: rawNonce,
      // Apple sends the name only on the very first authorization — forward it
      // so the backend can persist it (later logins come back nameless).
      ...(credential.firstName ? { firstName: credential.firstName } : {}),
      ...(credential.lastName ? { lastName: credential.lastName } : {}),
    },
  });

  if (!tokens?.accessToken && !tokens?.refreshToken) {
    throw new Error('Apple sign-in exchange returned no tokens');
  }

  await setTokens({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });

  // No callback URL to learn a host from — the discovery-resolved tenant host
  // IS the gateway (same guarantee the scheme-callback path relies on).
  const learnedHost = new URL(options.tenantHost).origin;
  storeTenantHost(learnedHost);
  try {
    await plugin.setTenantHost?.({ origin: learnedHost });
  } catch {
    // Optional capability — older shells (mobile) don't implement it.
  }

  return { tenantHostChanged: learnedHost !== options.bootHost.replace(/\/$/, '') };
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
