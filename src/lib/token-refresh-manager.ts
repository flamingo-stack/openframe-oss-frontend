/**
 * Centralized Token Refresh Manager
 *
 * Single source of truth for token refresh. Both ApiClient and AuthApiClient
 * delegate to this module.
 */

import { clearStoredTokens } from './force-logout';
import { nativeAuthPlugin } from './native-shell';
import { isAppShell } from './platform';
import { runtimeEnv } from './runtime-config';
import { getRefreshToken, getTokenEpoch, isBearerAuthMode, markTokenRotation, setTokens } from './token-store';

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

function buildRefreshUrl(tenantId?: string): string {
  const base = runtimeEnv.sharedHostUrl();
  const query = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
  const path = `/oauth/refresh${query}`;
  if (!base) return path;
  return `${base}${path}`;
}

async function executeRefresh(tenantId?: string): Promise<boolean> {
  // Shells that implement refreshTokens own the refresh entirely: the shell
  // also refreshes for its own connections on its own schedule, and rotating
  // refresh tokens tolerate exactly one refresher. The shell resolves with the
  // stored tokens after the attempt (empty = session over) and rejects only on
  // transient failures (network), where the stored tokens remain valid.
  const plugin = nativeAuthPlugin();
  if (plugin?.refreshTokens) {
    try {
      const tokens = await plugin.refreshTokens();
      if (tokens?.accessToken) {
        await setTokens(tokens);
        return true;
      }
      clearStoredTokens();
      return false;
    } catch {
      return false;
    }
  }

  const bearerMode = isBearerAuthMode();
  const url = buildRefreshUrl(tenantId);

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  // Whether this refresh is authenticated by a stored bearer refresh token. If
  // it isn't, the rotation rides the refresh COOKIE instead, and there is no
  // new bearer to store afterwards.
  let usingStoredRefreshToken = false;

  if (bearerMode) {
    const refreshToken = await getRefreshToken();
    if (refreshToken) {
      headers['Refresh-Token'] = refreshToken;
      usingStoredRefreshToken = true;
    } else if (isAppShell()) {
      // Native has no cookie jar, so no stored token means no credential at
      // all: the POST could only 401, and that 401 clears the stored tokens
      // below. Fatal during the biometric cold-start lock, where the tokens
      // exist in the Keychain but were never read — a racing credential-less
      // refresh would wipe them out from under the unlock gate.
      return false;
    }
    // Web dev-ticket mode with no stored token: the session was established by
    // cookie (only a `?devTicket=` exchange ever writes localStorage tokens),
    // so `credentials: 'include'` carries the refresh cookie. Bailing here made
    // EVERY 401 in that configuration terminal — no refresh was even attempted,
    // and the caller went straight to forceLogout.
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers,
    });

    if (!res.ok) {
      if (res.status === 401) {
        clearStoredTokens();
      }
      return false;
    }

    let data: any;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        data = await res.json();
      } catch {}
    }

    if (bearerMode) {
      const headerAccessToken = res.headers.get('Access-Token') || res.headers.get('access-token');
      const headerRefreshToken = res.headers.get('Refresh-Token') || res.headers.get('refresh-token');

      const newAccessToken = headerAccessToken || data?.access_token || data?.accessToken || null;
      const newRefreshToken = headerRefreshToken || data?.refresh_token || data?.refreshToken || null;

      if (newAccessToken) {
        await setTokens({ accessToken: newAccessToken, refreshToken: newRefreshToken });
      } else if (usingStoredRefreshToken) {
        // We authenticated with a stored bearer, so a rotation MUST hand one
        // back. Without it `setTokens` writes nothing (it skips falsy values)
        // and the expired bearer stays in place — reporting success made every
        // caller retry with the token that had just 401'd, and each of those
        // 401s started another rotation. Fail loudly instead.
        console.error('[Token Refresh] Rotation responded OK but carried no access token');
        return false;
      } else {
        // Cookie-authenticated session in dev-ticket mode: nothing to store,
        // the rotated cookie is the credential.
        markTokenRotation();
      }
    } else {
      // Cookie mode stores nothing client-side, so `setTokens` never runs and
      // never advances the epoch — record the rotation explicitly.
      markTokenRotation();
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Refresh the access token. Deduplicates concurrent calls — if a refresh is
 * already in progress, returns the existing promise.
 *
 * `observedEpoch` is the {@link getTokenEpoch} value captured just before the
 * request that hit the 401 was sent. When it no longer matches, that request
 * went out under a credential the app has since replaced: its 401 is stale
 * news and the caller only needs to retry with the current token. Refreshing
 * again would rotate a perfectly good credential — and with rotating refresh
 * tokens, a burst of concurrent 401s (every in-flight request when an access
 * token expires) rotated once per request until the backend rejected the reuse
 * and the app logged itself out. Callers that don't track an epoch omit it and
 * keep the previous always-refresh behavior.
 */
export async function refreshAccessToken(observedEpoch?: number): Promise<boolean> {
  // Checked BEFORE the in-flight join below, deliberately: a stale-epoch caller
  // already holds a newer credential, so it must NOT inherit a concurrent
  // rotation's result. That rotation can fail transiently (5xx / network blip on
  // `/oauth/refresh` — neither clears tokens), and `false` sends every HTTP
  // caller straight to `forceLogout()`. Retrying with the credential this caller
  // already has costs at most one failed request; a retry that 401s is not
  // terminal, it just fails that request.
  if (observedEpoch !== undefined && observedEpoch !== getTokenEpoch()) {
    return true;
  }

  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;

  refreshPromise = (async () => {
    try {
      const { useAuthStore } = await import('@/app/(auth)/auth/stores/auth-store');
      const authState = useAuthStore.getState();
      const tenantId =
        authState.tenantId || (authState.user as any)?.organizationId || (authState.user as any)?.tenantId;

      return await executeRefresh(tenantId || undefined);
    } catch {
      return false;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Check if a refresh is currently in progress
 */
export function isTokenRefreshing(): boolean {
  return isRefreshing;
}

/**
 * Wait for any in-progress refresh to complete
 */
export async function waitForRefresh(): Promise<boolean> {
  if (refreshPromise) {
    return refreshPromise;
  }
  return false;
}
