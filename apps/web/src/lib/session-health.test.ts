import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const tokens = vi.hoisted(() => ({
  epoch: 1,
  stored: true,
  bearer: true,
  listeners: new Set<() => void>(),
}));

vi.mock('./token-store', () => ({
  ACCESS_TOKEN_KEY: 'of_access_token',
  adoptNativeTokens: () => undefined,
  getAccessTokenSync: () => null,
  getRefreshToken: async () => null,
  getTokenEpoch: () => tokens.epoch,
  hasTokensSync: () => tokens.stored,
  isBearerAuthMode: () => tokens.bearer,
  markTokenRotation: () => {
    tokens.epoch += 1;
  },
  setTokens: async () => undefined,
  subscribeToTokenChange: (listener: () => void) => {
    tokens.listeners.add(listener);
    return () => tokens.listeners.delete(listener);
  },
}));
// Only the last block needs these: it runs the real client and the real refresh
// manager against this module, with the network and the shell stubbed out.
vi.mock('./client-identity', () => ({ clientIdentityHeaders: () => ({}), clientBundleVersion: () => '1.0.0' }));
vi.mock('./connectivity', () => ({ isOnline: () => true }));
vi.mock('./force-logout', () => ({ clearStoredTokens: () => undefined, forceLogout: async () => undefined }));
vi.mock('./native-shell', () => ({ nativeAuthPlugin: () => null, nativeShellVersion: () => null }));
vi.mock('./platform', () => ({ isAppShell: () => false, isMobileShell: () => false, mobilePlatform: () => null }));
vi.mock('./runtime-config', () => ({
  runtimeEnv: { tenantHostUrl: () => 'https://tenant.test', sharedHostUrl: () => 'https://auth.test' },
}));
vi.mock('./session-ready', () => ({ waitForSessionReady: () => Promise.resolve() }));
vi.mock('./subscription-gate', () => ({ waitForSubscriptionGate: () => Promise.resolve() }));

const res = (status: number, type = 'text/html') => new Response('', { status, headers: { 'Content-Type': type } });

async function load() {
  vi.resetModules();
  tokens.listeners.clear();
  return import('./session-health');
}

const emitTokenChange = () => {
  for (const listener of tokens.listeners) listener();
};

beforeEach(() => {
  tokens.epoch = 1;
  tokens.stored = true;
  tokens.bearer = true;
});

describe('session health', () => {
  it('starts healthy', async () => {
    const health = await load();
    expect(health.getSessionHealth()).toBe('healthy');
  });

  it('a transient pause resumes on a 2xx from the gateway', async () => {
    const health = await load();
    health.markSessionPaused('transient');
    expect(health.getSessionHealth()).toBe('paused');
    expect(health.noteGatewayResponse(res(401))).toBe(false);
    expect(health.getSessionHealth()).toBe('paused');
    expect(health.noteGatewayResponse(res(200))).toBe(false);
    expect(health.getSessionHealth()).toBe('healthy');
  });

  it('a rejected pause is not cleared by a 2xx from an unrelated request', async () => {
    const health = await load();
    health.markSessionPaused('rejected');
    expect(health.noteGatewayResponse(res(200))).toBe(false);
    expect(health.noteGatewayResponse(res(200))).toBe(false);
    expect(health.getSessionHealth()).toBe('paused');
    health.markSessionHealthy();
    expect(health.getSessionHealth()).toBe('healthy');
  });

  it('a rejected pause outlives a token rotation: the next 401 rotates, and would end its own pause', async () => {
    const health = await load();
    health.markSessionPaused('rejected');
    tokens.epoch = 2;
    emitTokenChange();
    expect(health.getSessionHealth()).toBe('paused');
  });

  it('a bearer sign-out leaves gone in place: the store is cleared while the app still looks signed in', async () => {
    const health = await load();
    health.noteGatewayResponse(res(410));
    tokens.stored = false;
    emitTokenChange();
    expect(health.getSessionHealth()).toBe('gone');
  });

  it('the next bearer sign-in ends whatever was known about the last session, a pause or gone', async () => {
    const health = await load();
    health.markSessionPaused('rejected');
    tokens.stored = false;
    emitTokenChange();
    expect(health.getSessionHealth()).toBe('paused');
    tokens.stored = true;
    emitTokenChange();
    expect(health.getSessionHealth()).toBe('healthy');

    health.noteGatewayResponse(res(410));
    tokens.stored = false;
    emitTokenChange();
    tokens.stored = true;
    emitTokenChange();
    expect(health.getSessionHealth()).toBe('healthy');
  });

  it('a cookie-mode token change is read as neither a sign-out nor a sign-in', async () => {
    const health = await load();
    tokens.bearer = false;
    tokens.stored = false;
    health.markSessionPaused('rejected');
    emitTokenChange();
    tokens.stored = true;
    emitTokenChange();
    expect(health.getSessionHealth()).toBe('paused');
  });

  it('a rejection upgrades a transient pause, and a transient mark never downgrades a rejected one', async () => {
    const health = await load();
    health.markSessionPaused('transient');
    health.markSessionPaused('rejected');
    health.noteGatewayResponse(res(200));
    expect(health.getSessionHealth()).toBe('paused');
    health.markSessionHealthy();
    health.markSessionPaused('rejected');
    health.markSessionPaused('transient');
    health.noteGatewayResponse(res(200));
    expect(health.getSessionHealth()).toBe('paused');
  });

  it('clears a pause on a token rotation, but not on a change at the same epoch', async () => {
    const health = await load();
    health.markSessionPaused('transient');
    emitTokenChange();
    expect(health.getSessionHealth()).toBe('paused');
    tokens.epoch = 2;
    emitTokenChange();
    expect(health.getSessionHealth()).toBe('healthy');
  });

  it('clearPauseIfTokenRotated covers a cookie-mode rotation that emits nothing', async () => {
    const health = await load();
    health.markSessionPaused('transient');
    tokens.epoch = 2;
    health.clearPauseIfTokenRotated();
    expect(health.getSessionHealth()).toBe('healthy');
  });

  it('goes gone on a 410 and a 2xx or a rotation does not bring it back', async () => {
    const health = await load();
    expect(health.noteGatewayResponse(res(410))).toBe(true);
    expect(health.isSessionGone()).toBe(true);
    health.noteGatewayResponse(res(200));
    tokens.epoch = 2;
    emitTokenChange();
    health.markSessionPaused('transient');
    expect(health.getSessionHealth()).toBe('gone');
  });

  it("treats a JSON 410 as the caller's own answer, not a deleted tenant", async () => {
    const health = await load();
    expect(health.noteGatewayResponse(res(410, 'application/json'))).toBe(false);
    expect(health.getSessionHealth()).toBe('healthy');
  });

  it('a pause can turn into gone', async () => {
    const health = await load();
    health.markSessionPaused('transient');
    health.noteGatewayResponse(res(410));
    expect(health.getSessionHealth()).toBe('gone');
  });

  it('resetSessionHealth is the way out of gone', async () => {
    const health = await load();
    health.noteGatewayResponse(res(410));
    health.resetSessionHealth();
    expect(health.getSessionHealth()).toBe('healthy');
  });
});

/**
 * The "can't verify your session" screen is this store paused as `transient`
 * (`app-layout.tsx`), so "never paused" below is "the screen never showed".
 * Cookie mode, as on the web: the gateway refuses until the refresh has rotated.
 */
describe('a 401 whose refresh ends up succeeding', () => {
  const BACKOFF_KEY = 'of_token_refresh_backoff';
  const ROTATION_KEY = 'of_token_rotated_at';
  let fetchMock: ReturnType<typeof vi.fn>;
  let refreshAnswers: Array<'dropped' | 'rotated'>;

  async function loadApp() {
    const health = await load();
    const { apiClient, AUTH_UNAVAILABLE_MESSAGE } = await import('./api-client');
    const manager = await import('./token-refresh-manager');
    const seen: string[] = [];
    health.useSessionHealthStore.subscribe(state => seen.push(state.health));
    return { health, apiClient, AUTH_UNAVAILABLE_MESSAGE, manager, seen };
  }

  beforeEach(() => {
    tokens.bearer = false;
    vi.useFakeTimers();
    const entries = new Map<string, string>();
    // Node's own Web Storage shadows jsdom's here and has no working methods.
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => entries.get(key) ?? null,
      removeItem: (key: string) => void entries.delete(key),
      setItem: (key: string, value: string) => void entries.set(key, value),
    });
    refreshAnswers = [];
    let rotated = false;
    fetchMock = vi.fn(async (url: string) => {
      if (url.startsWith('https://auth.test')) {
        if (refreshAnswers.shift() !== 'rotated') throw new TypeError('Failed to fetch');
        rotated = true;
        return new Response(null, { status: 204 });
      }
      return new Response('{}', { status: rotated ? 200 : 401, headers: { 'Content-Type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  const refreshPosts = () => fetchMock.mock.calls.filter(([url]) => String(url).startsWith('https://auth.test')).length;

  it('is never paused by one dropped refresh that the next cycle makes good', async () => {
    const { apiClient, seen } = await loadApp();
    refreshAnswers = ['dropped', 'rotated'];

    const response = apiClient.get('/api/devices');
    await vi.advanceTimersByTimeAsync(5_000);

    expect(await response).toMatchObject({ ok: true, status: 200 });
    expect(seen).toEqual([]);
    expect(refreshPosts()).toBe(2);
  });

  it('is never paused by a backoff the proactive refresh armed before any 401', async () => {
    const { apiClient, manager, seen } = await loadApp();
    localStorage.setItem(ROTATION_KEY, String(Date.now() - 14 * 60_000));
    refreshAnswers = ['dropped', 'rotated'];

    void manager.refreshIfStale();
    await vi.advanceTimersByTimeAsync(0);
    expect(refreshPosts()).toBe(1);

    const response = apiClient.get('/api/devices');
    await vi.advanceTimersByTimeAsync(5_000);

    expect(await response).toMatchObject({ ok: true, status: 200 });
    expect(seen).toEqual([]);
  });

  it("is never paused by another tab's first failed cycle", async () => {
    const { apiClient, seen } = await loadApp();
    localStorage.setItem(BACKOFF_KEY, `${Date.now() + 3_000}:1`);
    refreshAnswers = ['rotated'];

    const response = apiClient.get('/api/devices');
    await vi.advanceTimersByTimeAsync(3_000);

    expect(await response).toMatchObject({ ok: true, status: 200 });
    expect(seen).toEqual([]);
  });

  it('is paused once the second cycle fails too, and a Retry that rotates brings it back', async () => {
    const { apiClient, AUTH_UNAVAILABLE_MESSAGE, health, manager } = await loadApp();

    const response = apiClient.get('/api/devices');
    await vi.advanceTimersByTimeAsync(5_000);

    expect(await response).toMatchObject({ ok: false, status: 0, error: AUTH_UNAVAILABLE_MESSAGE });
    expect(health.isPausedFor('transient')).toBe(true);
    expect(refreshPosts()).toBe(2);

    // What the screen's Retry does (`session-unavailable-screen.tsx`).
    refreshAnswers = ['rotated'];
    expect(await manager.refreshTokens(undefined, { ignoreBackoff: true })).toBe('refreshed');
    health.clearPauseIfTokenRotated();
    expect(health.getSessionHealth()).toBe('healthy');
  });
});
