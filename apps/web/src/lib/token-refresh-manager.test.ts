import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * What a refresh failure MEANS is the point of this module and is invisible to
 * `tsc`: every outcome used to collapse into `false`, and every caller read
 * `false` as "sign the user out". These pin the classification, the fact that
 * only a 401 wipes stored tokens, and the cross-tab lock that stops two tabs
 * from spending the same rotating refresh token.
 */

const clearStoredTokens = vi.fn();
const setTokens = vi.fn(async (_tokens: { accessToken?: string | null; refreshToken?: string | null }) => undefined);
const markTokenRotation = vi.fn();
const adoptNativeTokens = vi.fn();
/** A shell bridge exposing `refreshTokens`; null stands in for the web. */
let shellPlugin: { refreshTokens: (options?: { rejectedAccessToken?: string }) => Promise<unknown> } | null = null;
let tokenEpoch = 0;
let accessToken: string | null = 'access-1';
let refreshToken: string | null = 'refresh-1';
let bearerMode = true;
let appShell = false;

vi.mock('./force-logout', () => ({ clearStoredTokens: () => clearStoredTokens() }));
vi.mock('./native-shell', () => ({ nativeAuthPlugin: () => shellPlugin }));
vi.mock('./platform', () => ({ isAppShell: () => appShell }));
vi.mock('./runtime-config', () => ({ runtimeEnv: { sharedHostUrl: () => 'https://auth.test' } }));
vi.mock('./token-store', () => ({
  ACCESS_TOKEN_KEY: 'of_access_token',
  getAccessTokenSync: () => accessToken,
  getRefreshToken: async () => refreshToken,
  getTokenEpoch: () => tokenEpoch,
  isBearerAuthMode: () => bearerMode,
  markTokenRotation: () => {
    tokenEpoch += 1;
    markTokenRotation();
  },
  setTokens: (tokens: { accessToken?: string | null; refreshToken?: string | null }) => setTokens(tokens),
  adoptNativeTokens: (tokens: { accessToken?: string | null; refreshToken?: string | null }) =>
    adoptNativeTokens(tokens),
}));

/**
 * Node's own (experimental) Web Storage shadows jsdom's in this runner and
 * exposes no working methods, so the module under test would silently take its
 * `catch` branches. A tiny in-memory stand-in keeps the cross-tab marker — the
 * thing these tests are actually about — observable.
 */
function memoryStorage(): Storage {
  const entries = new Map<string, string>();
  return {
    get length() {
      return entries.size;
    },
    clear: () => entries.clear(),
    getItem: (key: string) => entries.get(key) ?? null,
    key: (index: number) => [...entries.keys()][index] ?? null,
    removeItem: (key: string) => entries.delete(key) as unknown as void,
    setItem: (key: string, value: string) => {
      entries.set(key, value);
    },
  } as Storage;
}

function jsonResponse(status: number, headers: Record<string, string> = {}): Response {
  return new Response(status === 204 ? null : '{}', {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

async function loadManager() {
  vi.resetModules();
  return import('./token-refresh-manager');
}

beforeEach(() => {
  tokenEpoch = 0;
  accessToken = 'access-1';
  refreshToken = 'refresh-1';
  bearerMode = true;
  appShell = false;
  clearStoredTokens.mockClear();
  setTokens.mockClear();
  markTokenRotation.mockClear();
  adoptNativeTokens.mockClear();
  shellPlugin = null;
  vi.stubGlobal('localStorage', memoryStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('refreshTokens outcome classification', () => {
  it('reports `terminal` and clears tokens only for a 401', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(401)),
    );
    const { refreshTokens } = await loadManager();

    expect(await refreshTokens()).toBe('terminal');
    expect(clearStoredTokens).toHaveBeenCalledTimes(1);
  });

  it('reports `transient` for an auth-server 5xx and leaves the session alone', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(503));
    vi.stubGlobal('fetch', fetchMock);
    const { refreshTokens } = await loadManager();

    // Retries are part of the contract for server-side failures: the grant was
    // never processed, so re-sending the refresh token is not a reuse.
    expect(await refreshTokens()).toBe('transient');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(clearStoredTokens).not.toHaveBeenCalled();
  });

  it('reports `transient` for a transport failure WITHOUT retrying', async () => {
    // The response may have been lost after the server already rotated; a retry
    // would present a superseded token and turn a dropped packet into a 401.
    const fetchMock = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    vi.stubGlobal('fetch', fetchMock);
    const { refreshTokens } = await loadManager();

    expect(await refreshTokens()).toBe('transient');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(clearStoredTokens).not.toHaveBeenCalled();
  });

  it('reports `transient` for a WAF 403 — a rejected request is not a rejected credential', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(403)),
    );
    const { refreshTokens } = await loadManager();

    expect(await refreshTokens()).toBe('transient');
    expect(clearStoredTokens).not.toHaveBeenCalled();
  });

  it('stores the rotated pair and reports `refreshed` on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(204, { 'access-token': 'access-2', 'refresh-token': 'refresh-2' })),
    );
    const { refreshTokens } = await loadManager();

    expect(await refreshTokens()).toBe('refreshed');
    expect(setTokens).toHaveBeenCalledWith({ accessToken: 'access-2', refreshToken: 'refresh-2' });
    // Published for the other tabs, which adopt it instead of rotating again.
    expect(localStorage.getItem('of_token_rotated_at')).not.toBeNull();
  });

  it('adopts a credential installed while the refresh was in flight instead of clearing it', async () => {
    // The 401 answers a POST that was already obsolete when it landed: another
    // tab rotated meanwhile. Clearing here would destroy the token that tab
    // just obtained — the amplification that logs out every tab at once.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        accessToken = 'access-2';
        tokenEpoch += 1;
        return jsonResponse(401);
      }),
    );
    const { refreshTokens } = await loadManager();

    expect(await refreshTokens()).toBe('refreshed');
    expect(clearStoredTokens).not.toHaveBeenCalled();
  });
});

describe('rotation deduplication', () => {
  it('short-circuits a caller whose epoch is already stale', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(204, { 'access-token': 'access-2' }));
    vi.stubGlobal('fetch', fetchMock);
    const { refreshTokens } = await loadManager();

    tokenEpoch = 5;
    expect(await refreshTokens(4)).toBe('refreshed');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('joins concurrent callers to a single rotation', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(204, { 'access-token': 'access-2' }));
    vi.stubGlobal('fetch', fetchMock);
    const { refreshTokens } = await loadManager();

    const [a, b, c] = await Promise.all([refreshTokens(), refreshTokens(), refreshTokens()]);

    expect([a, b, c]).toEqual(['refreshed', 'refreshed', 'refreshed']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('adopts a rotation another tab performed while this one waited on the lock', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(204, { 'access-token': 'access-2' }));
    vi.stubGlobal('fetch', fetchMock);
    // Stand in for the real Web Lock: the other tab rotates while this call is
    // queued behind it, exactly as `navigator.locks` would serialize them.
    vi.stubGlobal('navigator', {
      locks: {
        request: async (_name: string, options: LockOptions, callback: () => Promise<unknown>) => {
          // The wait must be abortable, or a stuck holder stalls this tab's
          // requests with no way out.
          expect(options.signal).toBeInstanceOf(AbortSignal);
          localStorage.setItem('of_token_rotated_at', String(Date.now()));
          return callback();
        },
      },
    });
    const { refreshTokens } = await loadManager();

    expect(await refreshTokens()).toBe('refreshed');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rotates unserialized when the lock wait is aborted rather than failing the refresh', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(204, { 'access-token': 'access-2' }));
    vi.stubGlobal('fetch', fetchMock);
    // A holder that never yields: the wait aborts, and the fallback is the
    // pre-lock behavior (rotate anyway), never a failed refresh.
    vi.stubGlobal('navigator', {
      locks: {
        request: async () => {
          throw new DOMException('The request was aborted.', 'AbortError');
        },
      },
    });
    const { refreshTokens } = await loadManager();

    expect(await refreshTokens()).toBe('refreshed');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('shell-owned refresh', () => {
  it('delegates to the shell, names the refused bearer, and mirrors the answer without writing it back', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const plugin = { refreshTokens: vi.fn(async () => ({ accessToken: 'access-2', refreshToken: 'refresh-2' })) };
    shellPlugin = plugin;
    const { refreshTokens } = await loadManager();

    expect(await refreshTokens()).toBe('refreshed');
    // The webview never POSTs /oauth/refresh itself: rotating refresh tokens
    // tolerate exactly one refresher.
    expect(fetchMock).not.toHaveBeenCalled();
    expect(plugin.refreshTokens).toHaveBeenCalledWith({ rejectedAccessToken: 'access-1' });
    // Mirrored into the cache, never written back through setTokens — the shell
    // already stored it, and a write-back could land on top of a later rotation
    // and restore a spent refresh token.
    expect(adoptNativeTokens).toHaveBeenCalledWith({ accessToken: 'access-2', refreshToken: 'refresh-2' });
    expect(setTokens).not.toHaveBeenCalled();
  });

  it('reports `terminal` and clears when the shell answers with an empty set', async () => {
    shellPlugin = { refreshTokens: vi.fn(async () => ({})) };
    const { refreshTokens } = await loadManager();

    expect(await refreshTokens()).toBe('terminal');
    expect(clearStoredTokens).toHaveBeenCalledTimes(1);
  });

  it('reports `transient` when the shell rejects, leaving the session alone', async () => {
    // The shell rejects for everything that keeps the session intact — no
    // network path, an unknown outcome, a locked device, a biometric-gated store
    // it has not unlocked yet. None of those is a sign-out.
    shellPlugin = {
      refreshTokens: vi.fn(async () => {
        throw Object.assign(new Error('the device is locked'), { code: 'DEVICE_LOCKED' });
      }),
    };
    const { refreshTokens } = await loadManager();

    expect(await refreshTokens()).toBe('transient');
    expect(clearStoredTokens).not.toHaveBeenCalled();
    expect(adoptNativeTokens).not.toHaveBeenCalled();
  });
});

describe('backoff between cycles', () => {
  const BACKOFF_KEY = 'of_token_refresh_backoff';

  /** Freeze the clock only: the in-cycle `sleep`s stay real, so these use failures that do not retry. */
  function freezeClock() {
    vi.useFakeTimers({ toFake: ['Date'] });
  }

  it('answers `transient` without a request while the backoff from a failed cycle is pending', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(403));
    vi.stubGlobal('fetch', fetchMock);
    const { getRefreshBackoffRemainingMs, refreshTokens } = await loadManager();

    expect(await refreshTokens()).toBe('transient');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getRefreshBackoffRemainingMs()).toBeGreaterThan(0);
    // Published for the other tabs: the whole origin waits for the same moment.
    expect(localStorage.getItem(BACKOFF_KEY)).not.toBeNull();

    // The next 401 is "refresh pending", not a trigger — this is what turned one
    // failed refresh into hundreds of POSTs per page open.
    expect(await refreshTokens()).toBe('transient');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('honours a deadline another tab wrote', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(204, { 'access-token': 'access-2' }));
    vi.stubGlobal('fetch', fetchMock);
    localStorage.setItem(BACKOFF_KEY, `${Date.now() + 30_000}:2`);
    const { refreshTokens } = await loadManager();

    expect(await refreshTokens()).toBe('transient');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('runs a cycle at once for `ignoreBackoff` (the Retry button) and steps the delay up per failure', async () => {
    freezeClock();
    const fetchMock = vi.fn(async () => jsonResponse(403));
    vi.stubGlobal('fetch', fetchMock);
    const { getRefreshBackoffRemainingMs, refreshTokens } = await loadManager();

    await refreshTokens();
    expect(getRefreshBackoffRemainingMs()).toBe(5_000);

    expect(await refreshTokens(undefined, { ignoreBackoff: true })).toBe('transient');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(getRefreshBackoffRemainingMs()).toBe(15_000);

    await refreshTokens(undefined, { ignoreBackoff: true });
    expect(getRefreshBackoffRemainingMs()).toBe(60_000);

    // Capped at the last step.
    await refreshTokens(undefined, { ignoreBackoff: true });
    expect(getRefreshBackoffRemainingMs()).toBe(60_000);
  });

  it('runs again once the deadline passes, and starts the ladder over after a long quiet spell', async () => {
    freezeClock();
    const fetchMock = vi.fn(async () => jsonResponse(403));
    vi.stubGlobal('fetch', fetchMock);
    const { getRefreshBackoffRemainingMs, refreshTokens } = await loadManager();

    await refreshTokens();
    vi.setSystemTime(Date.now() + 6_000);
    expect(getRefreshBackoffRemainingMs()).toBe(0);

    // Shortly after the deadline: the same outage, so the next step.
    await refreshTokens();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(getRefreshBackoffRemainingMs()).toBe(15_000);

    // Long after it: a new outage, so the first step — a marker a sign-in never
    // cleared must not start at the cap.
    vi.setSystemTime(Date.now() + 15_000 + 61_000);
    await refreshTokens();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(getRefreshBackoffRemainingMs()).toBe(5_000);
  });

  it('clears the backoff after a successful rotation', async () => {
    let status = 403;
    const fetchMock = vi.fn(async () => jsonResponse(status, { 'access-token': 'access-2' }));
    vi.stubGlobal('fetch', fetchMock);
    const { getRefreshBackoffRemainingMs, refreshTokens } = await loadManager();

    await refreshTokens();
    status = 204;
    expect(await refreshTokens(undefined, { ignoreBackoff: true })).toBe('refreshed');
    expect(getRefreshBackoffRemainingMs()).toBe(0);
    expect(localStorage.getItem(BACKOFF_KEY)).toBeNull();

    // The next 401 rotates straight away again.
    await refreshTokens();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('clears the backoff when the refresh is rejected — the session is over, the next one starts clean', async () => {
    let status = 403;
    const fetchMock = vi.fn(async () => jsonResponse(status));
    vi.stubGlobal('fetch', fetchMock);
    const { getRefreshBackoffRemainingMs, refreshTokens } = await loadManager();

    await refreshTokens();
    status = 401;
    expect(await refreshTokens(undefined, { ignoreBackoff: true })).toBe('terminal');
    expect(getRefreshBackoffRemainingMs()).toBe(0);
  });

  it('arms nothing when no attempt was sent (no credential in the shell)', async () => {
    appShell = true;
    refreshToken = null;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { getRefreshBackoffRemainingMs, refreshTokens } = await loadManager();

    expect(await refreshTokens()).toBe('transient');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(getRefreshBackoffRemainingMs()).toBe(0);
  });

  it('paces a shell-owned refresh that fails the same way', async () => {
    shellPlugin = {
      refreshTokens: vi.fn(async () => {
        throw new Error('auth server unreachable');
      }),
    };
    const { getRefreshBackoffRemainingMs, refreshTokens } = await loadManager();

    expect(await refreshTokens()).toBe('transient');
    expect(getRefreshBackoffRemainingMs()).toBeGreaterThan(0);
    expect(await refreshTokens()).toBe('transient');
    expect(shellPlugin.refreshTokens).toHaveBeenCalledTimes(1);
  });
});

describe('cycle budget', () => {
  it('stops retrying once the budget is spent — a gateway that hangs its full timeout gets one attempt', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const fetchMock = vi.fn(async () => {
      // The gateway's own 30 s read timeout on the auth server, answered as 503.
      vi.setSystemTime(Date.now() + 30_000);
      return jsonResponse(503);
    });
    vi.stubGlobal('fetch', fetchMock);
    const { refreshTokens } = await loadManager();

    expect(await refreshTokens()).toBe('transient');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
