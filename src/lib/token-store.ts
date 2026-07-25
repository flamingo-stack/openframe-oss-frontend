/**
 * Single client-side custody point for OAuth tokens.
 *
 * Web builds keep the legacy behavior exactly: tokens exist in localStorage
 * only in dev-ticket (bearer) mode; cookie mode stores nothing client-side.
 * Native-shell builds persist tokens in the iOS Keychain (NativeAuth plugin)
 * and mirror them in module memory because many callers (fetch interceptors,
 * WebSocket URL builders) need synchronous reads.
 */
import { clearAuthedImageCache } from '@flamingo-stack/openframe-frontend-core/hooks';
import { BIOMETRIC_ERROR, biometricErrorCode, isBiometricLoginEnabled } from './native-biometrics';
import { isNativeShell, nativeAuthPlugin, onNativeTokenUpdate } from './native-shell';
import { runtimeEnv } from './runtime-config';

export const ACCESS_TOKEN_KEY = 'of_access_token';
export const REFRESH_TOKEN_KEY = 'of_refresh_token';

let cachedAccessToken: string | null = null;
let cachedRefreshToken: string | null = null;
let hydration: Promise<void> | null = null;
let tokenUpdateListenerRegistered = false;

let tokenEpoch = 0;

/**
 * Monotonic counter of credentials INSTALLED in this tab — advanced only once a
 * newer, usable credential is readable, never on a clear (see `clearTokens`).
 *
 * Callers capture it immediately before issuing a request and hand it back to
 * `refreshAccessToken()`. A 401 from a request SENT under an older epoch is
 * stale news: it went out with the previous token, the current one is already
 * newer, so it only needs a retry. Without this, every in-flight request that
 * 401s just after a rotation kicks off ANOTHER refresh — and with rotating
 * refresh tokens each extra rotation invalidates the credential just obtained,
 * ending in a forced logout.
 *
 * A counter rather than the more usual "compare the token you sent against the
 * current one" because cookie mode has no client-readable credential to
 * compare: the rotation happens entirely in the HttpOnly cookie jar. The
 * counter is the one signal that works in both auth modes.
 *
 * Scope is this JS realm. A rotation performed by ANOTHER tab writes shared
 * localStorage but does not advance this counter, so cross-tab bursts still
 * double-refresh — the same limitation the single-flight refresh manager has
 * always had. Fixing that needs the `storage` event, not a bigger counter.
 */
export function getTokenEpoch(): number {
  return tokenEpoch;
}

/**
 * Record a credential install that didn't go through `setTokens` — i.e. a
 * successful cookie-mode refresh, where the new credential lands in the cookie
 * jar and this module stores nothing.
 */
export function markTokenRotation(): void {
  tokenEpoch += 1;
}

/**
 * Cold-start outcome of the biometric-gated Keychain read (native only).
 * - `null`     — biometric login off, or the read succeeded (or nothing to read).
 * - `locked`   — the biometric prompt was canceled / failed transiently; the
 *                tokens are still there, the user just hasn't unlocked. The
 *                unlock gate shows and `retryTokenHydration()` re-prompts.
 * - `invalidated` — biometric enrollment changed, so the OS discarded the key
 *                and the tokens are unrecoverable; force a fresh login.
 */
export type BiometricLockState = 'locked' | 'invalidated' | null;
let biometricLockState: BiometricLockState = null;

type BiometricLockListener = (state: BiometricLockState) => void;
const biometricLockListeners = new Set<BiometricLockListener>();

export function getBiometricLockState(): BiometricLockState {
  return biometricLockState;
}

export function subscribeToBiometricLock(listener: BiometricLockListener): () => void {
  biometricLockListeners.add(listener);
  return () => biometricLockListeners.delete(listener);
}

function setBiometricLockState(state: BiometricLockState): void {
  if (biometricLockState === state) return;
  biometricLockState = state;
  for (const listener of biometricLockListeners) {
    try {
      listener(state);
    } catch (error) {
      console.error('[Token Store] biometric-lock listener failed:', error);
    }
  }
}

/**
 * Re-run the Keychain read after a canceled biometric prompt (the unlock gate's
 * Retry button). Drops the memoized hydration so `initTokenStore()` prompts
 * again; resolves once the retry settles so the caller can react to the new
 * lock state. No-op when not currently locked.
 */
export function retryTokenHydration(): Promise<void> {
  if (biometricLockState !== 'locked') return Promise.resolve();
  hydration = null;
  return initTokenStore();
}

/**
 * Abandon the cold-start biometric lock in favor of a normal sign-in (the
 * unlock gate's "log in another way" path). Only lifts the lock — the caller
 * owns the follow-up (forceLogout cleanup + navigation to /auth). Lifting it
 * first matters: forceLogout deliberately skips cleanup while `'locked'`.
 */
export function dismissBiometricLock(): void {
  if (biometricLockState !== 'locked') return;
  setBiometricLockState(null);
}

/**
 * Native token-change listeners. On the web, token rotations surface through the
 * `storage` event; on native, tokens live only in this module's memory + the
 * Keychain, so the DOM event never fires. Callers that cache a bearer token
 * (e.g. the NATS WS URL builder) subscribe here to react to rotations on native.
 */
type TokenChangeListener = () => void;
const tokenChangeListeners = new Set<TokenChangeListener>();

export function subscribeToTokenChange(listener: TokenChangeListener): () => void {
  tokenChangeListeners.add(listener);
  return () => tokenChangeListeners.delete(listener);
}

function emitTokenChange(): void {
  for (const listener of tokenChangeListeners) {
    try {
      listener();
    } catch (error) {
      console.error('[Token Store] token-change listener failed:', error);
    }
  }
}

/** Bearer-header auth is used instead of cookies: dev-ticket web mode, or always in the native shell. */
export function isBearerAuthMode(): boolean {
  return isNativeShell() || runtimeEnv.enableDevTicketObserver();
}

/** Hydrate the in-memory cache from the Keychain (native only). Safe to call repeatedly. */
export function initTokenStore(): Promise<void> {
  if (!hydration) {
    hydration = (async () => {
      if (!isNativeShell()) return;
      // Shells with a shell-side refresher rotate tokens while the webview is
      // idle — mirror every rotation into the cache. The event carries the
      // full stored set, so an empty payload means the session is over.
      // Once-guarded: a biometric retry re-runs this hydration body
      // (retryTokenHydration drops the memoized promise), and each
      // registration would stack another listener firing emitTokenChange.
      if (!tokenUpdateListenerRegistered) {
        tokenUpdateListenerRegistered = true;
        onNativeTokenUpdate(tokens => {
          cachedAccessToken = tokens.accessToken || null;
          cachedRefreshToken = tokens.refreshToken || null;
          // An empty payload is the session ending, not a new credential — same
          // reasoning as `clearTokens`, so it must not advance the epoch.
          if (cachedAccessToken) markTokenRotation();
          emitTokenChange();
        });
      }
      try {
        const tokens = await nativeAuthPlugin()?.getTokens();
        cachedAccessToken = tokens?.accessToken || null;
        cachedRefreshToken = tokens?.refreshToken || null;
        setBiometricLockState(null);
      } catch (error) {
        // With biometric login on, getTokens() prompts and can reject. A cancel
        // (or any generic failure) is NOT a signed-out state — the tokens are
        // still in the Keychain, unread — so surface a lock the unlock gate can
        // retry, rather than letting downstream null-token reads look logged out.
        // An invalidated enrollment means the key is gone: flag it so the
        // initializer forces a fresh login.
        const code = biometricErrorCode(error);
        if (code === BIOMETRIC_ERROR.INVALIDATED) {
          setBiometricLockState('invalidated');
        } else if (code === BIOMETRIC_ERROR.CANCELED || (await isBiometricLoginEnabled())) {
          // Explicit cancel, or any failure while biometric login is on: the
          // tokens are still in the Keychain, unread — lock (retryable), don't
          // fall through to a logged-out state.
          setBiometricLockState('locked');
        } else {
          // Non-biometric failure (or shells without biometric login): keep the
          // legacy behavior — log and let the 401 -> refresh path recover.
          console.error('[Token Store] Keychain hydration failed:', error);
        }
      }
    })();
  }
  return hydration;
}

function readLocalStorage(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Synchronous read: the Keychain-hydrated memory cache on native, localStorage
 * on the web. Before native hydration completes this returns null — callers on
 * that path recover via the 401 -> refresh -> retry flow (refresh awaits hydration).
 */
export function getAccessTokenSync(): string | null {
  return isNativeShell() ? cachedAccessToken : readLocalStorage(ACCESS_TOKEN_KEY);
}

export function getRefreshTokenSync(): string | null {
  return isNativeShell() ? cachedRefreshToken : readLocalStorage(REFRESH_TOKEN_KEY);
}

export async function getAccessToken(): Promise<string | null> {
  await initTokenStore();
  return getAccessTokenSync();
}

export async function getRefreshToken(): Promise<string | null> {
  await initTokenStore();
  return getRefreshTokenSync();
}

/** Store whichever tokens are present (rotation responses may carry one or both). */
export async function setTokens(tokens: { accessToken?: string | null; refreshToken?: string | null }): Promise<void> {
  const { accessToken, refreshToken } = tokens;
  if (isNativeShell()) {
    await initTokenStore();
    if (accessToken) cachedAccessToken = accessToken;
    if (refreshToken) cachedRefreshToken = refreshToken;
    // AFTER the cache write, never before: the epoch advertises "a newer
    // credential is readable", so bumping it while `getAccessTokenSync()` still
    // returns the old value would make a 401 in that window short-circuit to a
    // retry that re-sends the stale token — the exact failure it exists to stop.
    // (The Keychain write below may fail; the in-memory cache is what reads hit.)
    if (accessToken) markTokenRotation();
    try {
      // Native stores both tokens as ONE item, so send the full current pair —
      // a partial write would drop whichever token isn't included. The cache
      // above is the source of truth for the merged set.
      await nativeAuthPlugin()?.setTokens({
        accessToken: cachedAccessToken || undefined,
        refreshToken: cachedRefreshToken || undefined,
      });
    } catch (error) {
      console.error('[Token Store] Keychain write failed:', error);
    }
    emitTokenChange();
    return;
  }
  if (typeof window === 'undefined') return;
  try {
    if (accessToken) localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    // Only after the write lands — a throwing `setItem` (quota, private mode)
    // must NOT leave the epoch claiming a credential that was never stored.
    if (accessToken) markTokenRotation();
  } catch (error) {
    console.error('[Token Store] Failed to store tokens:', error);
  }
}

export async function clearTokens(): Promise<void> {
  cachedAccessToken = null;
  cachedRefreshToken = null;
  // Deliberately NOT a rotation: the epoch counts credentials INSTALLED, not
  // credentials changed. Bumping here would tell a 401 that arrived mid-logout
  // "someone already refreshed, just retry" — sending it out with no credential
  // at all. Leaving the epoch put lets that 401 take the refresh path, fail,
  // and settle as the sign-out it actually is.
  // Session end — drop blob object-URLs fetched under this identity's
  // bearer so a follow-on login as a different user can't be served them.
  clearAuthedImageCache();
  if (isNativeShell()) {
    try {
      await nativeAuthPlugin()?.clearTokens();
    } catch (error) {
      console.error('[Token Store] Keychain clear failed:', error);
    }
    emitTokenChange();
    return;
  }
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch (error) {
    console.error('[Token Store] Failed to clear tokens:', error);
  }
}

export function hasTokensSync(): boolean {
  return !!(getAccessTokenSync() || getRefreshTokenSync());
}
