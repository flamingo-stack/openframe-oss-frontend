/**
 * Native-shell login: runs the gateway BFF OAuth flow in a shell-owned browser
 * context, receives the dev-ticket on the callback, exchanges it natively, and
 * puts the tokens in the Keychain. On mobile the browser is an
 * ASWebAuthenticationSession completing on the app's custom scheme (Google
 * blocks OAuth in embedded webviews — 403 disallowed_useragent); the gateway
 * 302s the devTicket straight to that scheme for authMobile=true logins. The
 * desktop shell intercepts the https callback directly. Prototype flow —
 * requires `dev-ticket-enabled` on the gateway; not for production tenants.
 */
import { authApiClient } from './auth-api-client';
import { type NativeAuthPlugin, nativeAuthPlugin, storeTenantHost } from './native-shell';
import { isMobileShell, mobilePlatform } from './platform';
import { runtimeEnv } from './runtime-config';
import { setTokens } from './token-store';

const CALLBACK_PATH = '/auth/mobile-callback';

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

  const mobileScheme = runtimeEnv.mobileAppScheme();

  // Mobile (authMobile=true): the gateway 302s the devTicket straight to the
  // app's custom scheme — the auth session completes on it, no https landing.
  // Desktop: the BFF only accepts http(s) redirect targets there; the shell
  // window intercepts the tenant-host callback before navigation.
  // Either way redirectTarget must reach the gateway — start() below resolves on
  // nothing else — so loginUrl keeps it for any shell, saas-shared included.
  const redirectTarget = isMobileShell() ? `${mobileScheme}://auth` : `${tenantHost}${CALLBACK_PATH}`;
  const rawLoginUrl = authApiClient.loginUrl(options.tenantId, encodeURIComponent(redirectTarget), options.provider, {
    authMobile: isMobileShell(),
  });
  const loginUrl = rawLoginUrl.startsWith('http') ? rawLoginUrl : `${tenantHost}${rawLoginUrl}`;

  const { callbackUrl: resultUrl } = await plugin.start({
    url: loginUrl,
    callbackHost: new URL(tenantHost).hostname,
    callbackPath: CALLBACK_PATH,
    ...(isMobileShell() ? { callbackScheme: mobileScheme } : {}),
  });

  const parsedResult = new URL(resultUrl);
  const ticket = parsedResult.searchParams.get('devTicket');
  if (!ticket) {
    throw new Error('Login completed without a ticket — is dev-ticket enabled on the gateway?');
  }

  const exchangeBase = runtimeEnv.sharedHostUrl() || tenantHost;
  const { accessToken, refreshToken } = await plugin.exchangeTicket({
    url: `${exchangeBase}/oauth/dev-exchange?ticket=${encodeURIComponent(ticket)}`,
  });

  if (!accessToken && !refreshToken) {
    throw new Error('Ticket exchange returned no tokens');
  }

  await setTokens({ accessToken, refreshToken });

  // https callback (desktop): the origin is TLS-authenticated, take it as-is.
  // Scheme callback (mobile) carries no host — the discovery-resolved tenant
  // host is the gateway (the backend guarantees discovery `domain` is the
  // exact canonical tenant host).
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
