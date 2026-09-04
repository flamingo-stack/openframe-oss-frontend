/**
 * Centralized Token Refresh Manager
 *
 * Single source of truth for token refresh. ApiClient, AuthApiClient and the
 * Relay environment all delegate here.
 *
 * Two rules shape this module:
 *
 * 1. **A failed refresh is not automatically a dead session.** The BFF answers
 *    401 WITH cleared auth cookies for every rejection, so one unlucky refresh
 *    can end the session in every tab. Only a 401 is `terminal`; 5xx, a WAF 403,
 *    a dropped link and our own timeout are `transient` and must not log out.
 * 2. **Rotations are serialized across tabs.** Refresh tokens rotate and the
 *    backend has no CAS, so two tabs refreshing at once leave one of them with a
 *    dead token. A Web Lock plus a localStorage marker makes it single-flight
 *    for the whole origin.
 */

import { clearStoredTokens } from './force-logout';
import { nativeAuthPlugin } from './native-shell';
import { isAppShell } from './platform';
import { runtimeEnv } from './runtime-config';
import {
  ACCESS_TOKEN_KEY,
  getAccessTokenSync,
  getRefreshToken,
  getTokenEpoch,
  isBearerAuthMode,
  markTokenRotation,
  setTokens,
} from './token-store';

/** What the attempt says about the SESSION — not whether the request succeeded. */
export type RefreshOutcome = 'refreshed' | 'transient' | 'terminal';

let isRefreshing = false;
let refreshPromise: Promise<RefreshOutcome> | null = null;

const REFRESH_LOCK_NAME = 'openframe-token-refresh';
/** Plain timestamp, no token material — safe in cookie mode, where nothing else is stored. */
const ROTATION_MARKER_KEY = 'of_token_rotated_at';

/** `fetch` has no timeout; without one a hung refresh stalls every 401 waiting on it. */
const REFRESH_TIMEOUT_MS = 15_000;

/**
 * Retries for SERVER-side failures only (5xx/408/429): the grant was refused or
 * never processed, so re-sending is not a reuse. A transport failure is not
 * retried — the response may have been lost after the server rotated, and a
 * retry with the superseded token would 401 and sign the user out.
 */
const RETRY_DELAYS_MS = [1_000, 2_500];

/** How recent another tab's rotation must be for this call to adopt it. */
const ROTATION_ADOPTION_WINDOW_MS = 10_000;

/** Above the worst case a healthy holder can take, so a stuck one can't stall this tab. */
const LOCK_WAIT_TIMEOUT_MS = 25_000;

/** Refresh proactively once the access token is within this much of expiring. */
const PROACTIVE_REFRESH_LEEWAY_MS = 2 * 60_000;

/** Cookie-mode fallback, where expiry can't be read. Backend access TTL is 900s. */
const PROACTIVE_REFRESH_AFTER_MS = 13 * 60_000;

/**
 * No `tenantId` query param, deliberately: the BFF resolves the tenant from the
 * refresh token itself, and a bare UUID in the URL trips Cloud Armor's CRS
 * 942431/942432. The lookup is indexed, so this is not trading a WAF hit for a
 * collection scan.
 */
function buildRefreshUrl(): string {
  const base = runtimeEnv.sharedHostUrl();
  const path = '/oauth/refresh';
  if (!base) return path;
  return `${base}${path}`;
}

function readRotationMarker(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(ROTATION_MARKER_KEY);
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Publishes the rotation to the other tabs — this write is what fires their `storage` listener. */
function markRotationTimestamp(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ROTATION_MARKER_KEY, String(Date.now()));
  } catch {
    // Quota/private-mode failures only cost the cross-tab hint.
  }
}

let crossTabSyncRegistered = false;

/**
 * Adopt rotations performed by other tabs. A removal (`newValue === null`) is a
 * sign-out, not a rotation: advancing the epoch for it would tell a mid-logout
 * 401 "just retry", with no credential to retry with.
 */
function initCrossTabSync(): void {
  if (crossTabSyncRegistered || typeof window === 'undefined') return;
  crossTabSyncRegistered = true;
  window.addEventListener('storage', event => {
    if (event.key !== ROTATION_MARKER_KEY && event.key !== ACCESS_TOKEN_KEY) return;
    if (!event.newValue) return;
    markTokenRotation();
  });
}

initCrossTabSync();

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Millisecond `exp` of a JWT, or `null` when it cannot be read (opaque token, malformed). */
function readJwtExpiryMs(token: string): number | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')));
    return typeof decoded?.exp === 'number' ? decoded.exp * 1000 : null;
  } catch {
    return null;
  }
}

/** Snapshot of the credential being rotated, so a 401 can be told apart from "someone replaced it". */
interface CredentialSnapshot {
  epoch: number;
  accessToken: string | null;
}

function snapshotCredential(): CredentialSnapshot {
  return { epoch: getTokenEpoch(), accessToken: getAccessTokenSync() };
}

function credentialReplacedSince(snapshot: CredentialSnapshot): boolean {
  return getTokenEpoch() !== snapshot.epoch || getAccessTokenSync() !== snapshot.accessToken;
}

/** One `/oauth/refresh` POST. `retriable` means "server-side failure, safe to send again". */
async function attemptRefresh(): Promise<RefreshOutcome | 'retriable'> {
  const bearerMode = isBearerAuthMode();
  const url = buildRefreshUrl();

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  /** False means the rotation rides the refresh COOKIE, so no new bearer comes back. */
  let usingStoredRefreshToken = false;

  if (bearerMode) {
    const refreshToken = await getRefreshToken();
    if (refreshToken) {
      headers['Refresh-Token'] = refreshToken;
      usingStoredRefreshToken = true;
    } else if (isAppShell()) {
      // Native has no cookie jar: no stored token means no credential at all.
      // Fatal during the biometric cold-start lock, where the tokens sit in the
      // Keychain unread and a credential-less refresh would clear them.
      return 'transient';
    }
    // Web dev-ticket mode with no stored token still has the refresh cookie —
    // fall through and let `credentials: 'include'` carry it.
  }

  const snapshot = snapshotCredential();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REFRESH_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers,
      signal: controller.signal,
    });
  } catch {
    return 'transient';
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    if (res.status === 401) {
      // A credential installed while this POST was in flight (another tab's
      // rotation) outranks the 401: clearing would destroy the token that tab
      // just obtained.
      if (credentialReplacedSince(snapshot)) {
        return 'refreshed';
      }
      clearStoredTokens();
      return 'terminal';
    }
    if (res.status >= 500 || res.status === 408 || res.status === 429) {
      return 'retriable';
    }
    // A WAF 403, a misrouted 400, an `invalid_client` — none of these say
    // anything about the user's credential.
    return 'transient';
  }

  // Whichever casing the auth service used for this deployment.
  let data: { access_token?: string; accessToken?: string; refresh_token?: string; refreshToken?: string } | undefined;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await res.json();
    } catch {
      // A response that claims JSON but does not parse leaves `data` undefined, which the caller below already treats as "no body".
    }
  }

  if (bearerMode) {
    const headerAccessToken = res.headers.get('Access-Token') || res.headers.get('access-token');
    const headerRefreshToken = res.headers.get('Refresh-Token') || res.headers.get('refresh-token');

    const newAccessToken = headerAccessToken || data?.access_token || data?.accessToken || null;
    const newRefreshToken = headerRefreshToken || data?.refresh_token || data?.refreshToken || null;

    if (newAccessToken) {
      await setTokens({ accessToken: newAccessToken, refreshToken: newRefreshToken });
    } else if (usingStoredRefreshToken) {
      // We authenticated with a stored bearer, so the rotation happened and the
      // stored token is spent — but nothing came back to replace it.
      console.error('[Token Refresh] Rotation responded OK but carried no access token');
      return 'terminal';
    } else {
      markTokenRotation();
    }
  } else {
    // Cookie mode stores nothing client-side, so record the rotation explicitly.
    markTokenRotation();
  }

  markRotationTimestamp();
  return 'refreshed';
}

async function executeRefresh(): Promise<RefreshOutcome> {
  // Shells that implement refreshTokens own the refresh entirely — rotating
  // refresh tokens tolerate exactly one refresher. The shell resolves with the
  // stored tokens (empty = session over) and rejects only on transient failures.
  const plugin = nativeAuthPlugin();
  if (plugin?.refreshTokens) {
    try {
      const tokens = await plugin.refreshTokens();
      if (tokens?.accessToken) {
        await setTokens(tokens);
        return 'refreshed';
      }
      clearStoredTokens();
      return 'terminal';
    } catch {
      return 'transient';
    }
  }

  for (let attempt = 0; ; attempt++) {
    const outcome = await attemptRefresh();
    if (outcome !== 'retriable') return outcome;
    if (attempt >= RETRY_DELAYS_MS.length) return 'transient';
    await sleep(RETRY_DELAYS_MS[attempt]);
  }
}

/**
 * "Another tab rotated while this call was queued." Its `storage` event may not
 * have arrived yet, so advance the epoch here too — an extra tick only makes
 * stale 401s retry, which is correct once a newer credential exists.
 */
function adoptRotationSince(waitStartedAt: number): boolean {
  const rotatedAt = readRotationMarker();
  const adoptable =
    rotatedAt !== null && rotatedAt >= waitStartedAt && Date.now() - rotatedAt < ROTATION_ADOPTION_WINDOW_MS;
  if (adoptable) markTokenRotation();
  return adoptable;
}

/**
 * Serialize the rotation across every tab of this origin. The fallback path is
 * for non-browser realms (SSR, tests) and keeps the old per-realm behavior.
 *
 * The wait is bounded: on timeout the rotation proceeds unserialized, so the
 * worst case is the old race rather than a hung refresh.
 */
async function runExclusive(waitStartedAt: number): Promise<RefreshOutcome> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  if (!locks?.request) return executeRefresh();

  const abortWait = new AbortController();
  const waitTimer = setTimeout(() => abortWait.abort(), LOCK_WAIT_TIMEOUT_MS);

  try {
    return (await locks.request(REFRESH_LOCK_NAME, { signal: abortWait.signal }, async () => {
      if (adoptRotationSince(waitStartedAt)) return 'refreshed';
      return executeRefresh();
    })) as RefreshOutcome;
  } catch (error) {
    // AbortError = the wait timed out; the callback never ran, nothing rotated.
    if (error instanceof DOMException && error.name === 'AbortError') {
      if (adoptRotationSince(waitStartedAt)) return 'refreshed';
      return executeRefresh();
    }
    throw error;
  } finally {
    clearTimeout(waitTimer);
  }
}

/**
 * Refresh the access token, reporting what the attempt says about the session.
 * Concurrent calls join the in-flight rotation.
 *
 * `observedEpoch` is {@link getTokenEpoch} captured just before the request that
 * hit the 401 was sent. When it no longer matches, that request went out under a
 * credential the app has since replaced: its 401 is stale news and the caller
 * only needs to retry. Without this, every in-flight request that 401s after a
 * rotation starts another one — and each extra rotation invalidates the
 * credential just obtained.
 */
export async function refreshTokens(observedEpoch?: number): Promise<RefreshOutcome> {
  // Checked BEFORE joining an in-flight rotation: a stale-epoch caller already
  // holds a newer credential and must not inherit that rotation's failure.
  if (observedEpoch !== undefined && observedEpoch !== getTokenEpoch()) {
    return 'refreshed';
  }

  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  const waitStartedAt = Date.now();

  refreshPromise = (async () => {
    try {
      return await runExclusive(waitStartedAt);
    } catch {
      return 'transient';
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Boolean form for callers that only need "can I retry?" (the MeshCentral socket
 * and the chat runtime adapter). Anything deciding whether to SIGN THE USER OUT
 * must use {@link refreshTokens}: `false` here conflates a dead session with a 502.
 */
export async function refreshAccessToken(observedEpoch?: number): Promise<boolean> {
  return (await refreshTokens(observedEpoch)) === 'refreshed';
}

/**
 * Rotate ahead of expiry when a tab returns to the foreground, so a page's worth
 * of requests doesn't 401 in unison. No-op when the shell owns refreshing, when
 * the credential is still fresh, or when there is nothing to refresh.
 */
export async function refreshIfStale(): Promise<void> {
  if (nativeAuthPlugin()?.refreshTokens) return;
  if (!isCredentialStale()) return;
  await refreshTokens();
}

function isCredentialStale(): boolean {
  if (isBearerAuthMode()) {
    const accessToken = getAccessTokenSync();
    // No token means signed out (or still hydrating) — the 401 path owns that.
    if (!accessToken) return false;
    const expiresAt = readJwtExpiryMs(accessToken);
    if (expiresAt !== null) return expiresAt - Date.now() < PROACTIVE_REFRESH_LEEWAY_MS;
  }

  // Cookie mode: the credential can't be inspected, so fall back to how long ago
  // this browser last rotated. No marker ⇒ no evidence it is old.
  const rotatedAt = readRotationMarker();
  if (rotatedAt === null) return false;
  return Date.now() - rotatedAt > PROACTIVE_REFRESH_AFTER_MS;
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
    return (await refreshPromise) === 'refreshed';
  }
  return false;
}
