/**
 * Centralized Token Refresh Manager
 *
 * Single source of truth for token refresh. ApiClient, AuthApiClient and the
 * Relay environment all delegate here.
 *
 * Three rules shape this module:
 *
 * 1. **A failed refresh is not automatically a dead session.** The BFF answers
 *    401 for every refresh token it rejects, so one unlucky refresh can end the
 *    session in every tab. Only a 401 is `terminal`; 5xx, a WAF 403, a dropped
 *    link and our own timeout are `transient` and must not log out.
 * 2. **Rotations are serialized across tabs.** Refresh tokens rotate and the
 *    backend has no CAS, so two tabs refreshing at once leave one of them with a
 *    dead token. A Web Lock plus a localStorage marker makes it single-flight
 *    for the whole origin.
 * 3. **Cycles are spaced once one has failed.** A `transient` cycle arms a
 *    backoff shared by every tab, and until it lapses a 401 is answered
 *    `transient` from here, with no request. Without it every 401 that followed
 *    a failed cycle — `/api/me`'s own retries, every page query the session gate
 *    released — started another three-POST cycle at once: hundreds of
 *    `/oauth/refresh` per page open while the auth service was down, and a page
 *    that never left its skeletons.
 */

import { clearStoredTokens } from './force-logout';
import { nativeAuthPlugin } from './native-shell';
import { isAppShell } from './platform';
import { runtimeEnv } from './runtime-config';
import {
  ACCESS_TOKEN_KEY,
  adoptNativeTokens,
  getAccessTokenSync,
  getRefreshToken,
  getTokenEpoch,
  isBearerAuthMode,
  markTokenRotation,
  setTokens,
} from './token-store';

/** What the attempt says about the SESSION — not whether the request succeeded. */
export type RefreshOutcome = 'refreshed' | 'transient' | 'terminal';

export interface RefreshOptions {
  /**
   * Run a cycle now even while the between-cycle backoff is pending — the Retry
   * of the "can't verify your session" screen. A failure arms the next step as
   * usual.
   */
  ignoreBackoff?: boolean;
}

let isRefreshing = false;
let refreshPromise: Promise<RefreshOutcome> | null = null;

const REFRESH_LOCK_NAME = 'openframe-token-refresh';
/** Plain timestamp, no token material — safe in cookie mode, where nothing else is stored. */
const ROTATION_MARKER_KEY = 'of_token_rotated_at';

/**
 * `fetch` has no timeout; without one a hung refresh stalls every 401 waiting on
 * it. Above the gateway's own 30 s connect + read timeout on the auth server, on
 * purpose: the gateway answers a hang with a 503 (`retriable`) and a late auth
 * server with a rotation. Giving up before it answers would classify the hang as
 * our own timeout — a transport failure, not retried because the response may
 * carry a rotation — and could leave this browser holding a refresh token the
 * server has already rotated away.
 */
const REFRESH_TIMEOUT_MS = 35_000;

/**
 * Retries for SERVER-side failures only (5xx/408/429): the grant was refused or
 * never processed, so re-sending is not a reuse. A transport failure is not
 * retried — the response may have been lost after the server rotated, and a
 * retry with the superseded token would 401 and sign the user out.
 */
const RETRY_DELAYS_MS = [1_000, 2_500];

/**
 * How long one cycle may keep scheduling attempts. Bounds elapsed time, not
 * attempts: a gateway that takes its full timeout to answer 503 is hanging, not
 * flapping, and a second 30 s attempt against it only delays the error state.
 * Fast 503s (the auth server refusing connections behind the gateway) still get
 * every attempt in `RETRY_DELAYS_MS`.
 */
const CYCLE_BUDGET_MS = 30_000;

/**
 * Delay between CYCLES after one ends `transient`, per consecutive failure, the
 * last one repeating. Shared across tabs through `BACKOFF_MARKER_KEY` so the
 * whole origin waits for the same moment, and reset by the next success. The
 * numbers are the BE contract's proposal; the requirement is that cycles are
 * spaced and capped.
 */
const CYCLE_BACKOFF_DELAYS_MS = [5_000, 15_000, 60_000];

/** `<deadline ms>:<consecutive failures>` — a timestamp and a count, no token material. */
const BACKOFF_MARKER_KEY = 'of_token_refresh_backoff';

/** How recent another tab's rotation must be for this call to adopt it. */
const ROTATION_ADOPTION_WINDOW_MS = 10_000;

/**
 * Above one attempt's ceiling, so a holder waiting out a hung gateway is not
 * raced by a second, unserialized rotation; a holder still busy past that is
 * treated as stuck, and this tab rotates on its own as before.
 */
const LOCK_WAIT_TIMEOUT_MS = REFRESH_TIMEOUT_MS + 10_000;

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

interface CycleBackoff {
  /** When the next cycle may start. */
  until: number;
  /** Consecutive `transient` cycles — picks the next delay. */
  failures: number;
}

/**
 * This realm's copy of the backoff: the source of truth where storage is
 * unavailable (private mode, quota), so the automatic retry behind the
 * "can't verify your session" screen can never tighten into back-to-back cycles.
 */
let memoryBackoff: CycleBackoff | null = null;

function parseBackoff(raw: string | null): CycleBackoff | null {
  if (!raw) return null;
  const [until, failures] = raw.split(':').map(Number);
  return Number.isFinite(until) && Number.isFinite(failures) ? { until, failures } : null;
}

function readStoredBackoff(): CycleBackoff | null {
  if (typeof window === 'undefined') return null;
  try {
    return parseBackoff(localStorage.getItem(BACKOFF_MARKER_KEY));
  } catch {
    return null;
  }
}

/** The later of the stored and the in-memory deadline: another tab's failure counts here too. */
function readBackoff(): CycleBackoff | null {
  const stored = readStoredBackoff();
  if (!stored) return memoryBackoff;
  if (!memoryBackoff) return stored;
  return stored.until >= memoryBackoff.until ? stored : memoryBackoff;
}

function writeBackoff(backoff: CycleBackoff | null): void {
  memoryBackoff = backoff;
  if (typeof window === 'undefined') return;
  try {
    if (backoff) localStorage.setItem(BACKOFF_MARKER_KEY, `${backoff.until}:${backoff.failures}`);
    else localStorage.removeItem(BACKOFF_MARKER_KEY);
  } catch {
    // Storage failures only cost the cross-tab share of the backoff.
  }
}

/** Arm (or step up) the between-cycle backoff after a `transient` cycle. */
function armCycleBackoff(): void {
  const previous = readBackoff();
  const maxDelay = CYCLE_BACKOFF_DELAYS_MS[CYCLE_BACKOFF_DELAYS_MS.length - 1];
  // A failure long after the last deadline is a new outage, not the next step
  // of the old one — a marker a sign-in never cleared must not start at the cap.
  const continuing = previous !== null && Date.now() - previous.until < maxDelay;
  const failures = continuing ? previous.failures + 1 : 1;
  const delay = CYCLE_BACKOFF_DELAYS_MS[Math.min(failures, CYCLE_BACKOFF_DELAYS_MS.length) - 1];
  writeBackoff({ until: Date.now() + delay, failures });
}

/** A rotation succeeded, or the session ended: the next cycle starts clean. */
function clearCycleBackoff(): void {
  if (readBackoff()) writeBackoff(null);
}

/**
 * Milliseconds until the next refresh cycle may start; 0 when none is pending.
 * The "can't verify your session" screen schedules its automatic retry on it.
 */
export function getRefreshBackoffRemainingMs(): number {
  const backoff = readBackoff();
  return backoff ? Math.max(0, backoff.until - Date.now()) : 0;
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

/**
 * One `/oauth/refresh` POST. `retriable` means "server-side failure, safe to send
 * again"; `skipped` means nothing was sent, because there was no credential to
 * send — so nothing failed either.
 */
async function attemptRefresh(): Promise<RefreshOutcome | 'retriable' | 'skipped'> {
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
      return 'skipped';
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

/**
 * One refresh CYCLE: the attempts of `RETRY_DELAYS_MS` within `CYCLE_BUDGET_MS`.
 * Its answer is what arms or clears the between-cycle backoff: `transient` arms
 * it, `refreshed` and `terminal` clear it, a skipped attempt leaves it alone.
 */
async function executeRefresh(): Promise<RefreshOutcome> {
  // Shells that implement refreshTokens own the refresh entirely — rotating
  // refresh tokens tolerate exactly one refresher. The shell resolves with the
  // stored tokens (empty = session over) and rejects only on transient failures.
  const plugin = nativeAuthPlugin();
  if (plugin?.refreshTokens) {
    try {
      // The bearer this side holds is the one the gateway refused. A shell whose
      // stored token already differs rotated on its own meanwhile and answers
      // from that, instead of spending another refresh token on a stale report.
      const tokens = await plugin.refreshTokens({ rejectedAccessToken: getAccessTokenSync() ?? undefined });
      if (tokens?.accessToken) {
        // The shell already stored the pair — mirror it, never write it back
        // (see adoptNativeTokens).
        adoptNativeTokens(tokens);
        clearCycleBackoff();
        return 'refreshed';
      }
      clearStoredTokens();
      clearCycleBackoff();
      return 'terminal';
    } catch {
      // The shell made one attempt and it failed; the pacing is the same as for
      // our own attempts, so an auth outage under the desktop app is spaced too.
      armCycleBackoff();
      return 'transient';
    }
  }

  const startedAt = Date.now();
  for (let attempt = 0; ; attempt++) {
    const result = await attemptRefresh();
    if (result === 'skipped') return 'transient';
    if (result === 'retriable') {
      const delay = RETRY_DELAYS_MS[attempt];
      if (delay !== undefined && Date.now() - startedAt + delay < CYCLE_BUDGET_MS) {
        await sleep(delay);
        continue;
      }
      armCycleBackoff();
      return 'transient';
    }
    if (result === 'transient') armCycleBackoff();
    else clearCycleBackoff();
    return result;
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
async function runExclusive(waitStartedAt: number, ignoreBackoff: boolean): Promise<RefreshOutcome> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  if (!locks?.request) return executeRefresh();

  const abortWait = new AbortController();
  const waitTimer = setTimeout(() => abortWait.abort(), LOCK_WAIT_TIMEOUT_MS);

  try {
    return (await locks.request(REFRESH_LOCK_NAME, { signal: abortWait.signal }, async () => {
      if (adoptRotationSince(waitStartedAt)) return 'refreshed';
      // The holder ahead of this tab may have just failed and armed the backoff.
      if (!ignoreBackoff && getRefreshBackoffRemainingMs() > 0) return 'transient';
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
export async function refreshTokens(observedEpoch?: number, options: RefreshOptions = {}): Promise<RefreshOutcome> {
  // Checked BEFORE joining an in-flight rotation: a stale-epoch caller already
  // holds a newer credential and must not inherit that rotation's failure.
  if (observedEpoch !== undefined && observedEpoch !== getTokenEpoch()) {
    return 'refreshed';
  }

  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  // A cycle has failed and its backoff has not lapsed: this 401 is "refresh
  // pending", not a trigger. Answered as that cycle was, without a request.
  const ignoreBackoff = options.ignoreBackoff === true;
  if (!ignoreBackoff && getRefreshBackoffRemainingMs() > 0) {
    return 'transient';
  }

  isRefreshing = true;
  const waitStartedAt = Date.now();

  refreshPromise = (async () => {
    try {
      return await runExclusive(waitStartedAt, ignoreBackoff);
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
