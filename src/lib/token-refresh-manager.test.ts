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
let tokenEpoch = 0;
let accessToken: string | null = 'access-1';
let bearerMode = true;

vi.mock('./force-logout', () => ({ clearStoredTokens: () => clearStoredTokens() }));
vi.mock('./native-shell', () => ({ nativeAuthPlugin: () => null }));
vi.mock('./platform', () => ({ isAppShell: () => false }));
vi.mock('./runtime-config', () => ({ runtimeEnv: { sharedHostUrl: () => 'https://auth.test' } }));
vi.mock('./token-store', () => ({
  ACCESS_TOKEN_KEY: 'of_access_token',
  getAccessTokenSync: () => accessToken,
  getRefreshToken: async () => 'refresh-1',
  getTokenEpoch: () => tokenEpoch,
  isBearerAuthMode: () => bearerMode,
  markTokenRotation: () => {
    tokenEpoch += 1;
    markTokenRotation();
  },
  setTokens: (tokens: { accessToken?: string | null; refreshToken?: string | null }) => setTokens(tokens),
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
  bearerMode = true;
  clearStoredTokens.mockClear();
  setTokens.mockClear();
  markTokenRotation.mockClear();
  vi.stubGlobal('localStorage', memoryStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
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
