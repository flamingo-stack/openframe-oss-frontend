import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  refreshTokens: vi.fn(),
  forceLogout: vi.fn(),
  epoch: 1,
}));

vi.mock('./platform', () => ({ isMobileShell: () => true, mobilePlatform: () => 'ios' }));
vi.mock('./client-identity', () => ({
  clientIdentityHeaders: () => ({ 'X-OpenFrame-Client': 'ios/1.0.1 bundle/1.0.100' }),
  clientBundleVersion: () => '1.0.100',
}));
vi.mock('./session-ready', () => ({ waitForSessionReady: () => Promise.resolve() }));
vi.mock('./subscription-gate', () => ({ waitForSubscriptionGate: () => Promise.resolve() }));
vi.mock('./token-refresh-manager', () => ({ refreshTokens: mocks.refreshTokens }));
vi.mock('./force-logout', () => ({ forceLogout: mocks.forceLogout }));
vi.mock('./token-store', () => ({
  getAccessTokenSync: () => 'token',
  getTokenEpoch: () => mocks.epoch,
  isBearerAuthMode: () => true,
  subscribeToTokenChange: () => () => undefined,
}));
vi.mock('./runtime-config', () => ({
  runtimeEnv: { tenantHostUrl: () => 'https://tenant.example.com', sharedHostUrl: () => '' },
}));

async function loadSessionHealth() {
  return import('./session-health');
}

const UPGRADE_BODY = { code: 'CLIENT_UPGRADE_REQUIRED', minBundleVersion: '1.0.120', storeUrl: 'itms-apps://x' };

async function load() {
  vi.resetModules();
  const [{ apiClient }, versionCheck] = await Promise.all([import('./api-client'), import('./version-check')]);
  return { apiClient, versionCheck };
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  mocks.epoch = 1;
  mocks.refreshTokens.mockReset();
  mocks.forceLogout.mockReset();
  fetchMock = vi.fn(() =>
    Promise.resolve(
      new Response(JSON.stringify(UPGRADE_BODY), { status: 426, headers: { 'Content-Type': 'application/json' } }),
    ),
  );
  vi.stubGlobal('fetch', fetchMock);
});

describe('apiClient on 426', () => {
  it('reports it, flips the update state, and never touches the session', async () => {
    const { apiClient, versionCheck } = await load();
    const response = await apiClient.get('/api/devices');
    expect(response).toMatchObject({ status: 426, ok: false });
    expect(versionCheck.isUpdateRequired()).toBe(true);
    expect(versionCheck.resolveStoreUrl()).toBe('itms-apps://x');
    expect(mocks.refreshTokens).not.toHaveBeenCalled();
    expect(mocks.forceLogout).not.toHaveBeenCalled();
  });

  it('answers every later request locally, so no retry reaches the wire', async () => {
    const { apiClient } = await load();
    await apiClient.get('/api/devices');
    const again = await apiClient.post('/api/graphql', { query: '{ x }' });
    expect(again).toMatchObject({ status: 426, ok: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('apiClient session health', () => {
  const respond =
    (status: number, type = status === 410 ? 'text/html' : 'application/json') =>
    () =>
      Promise.resolve(new Response('{}', { status, headers: { 'Content-Type': type } }));

  it('pauses the session when a 401 survives a successful refresh, and returns the plain 401', async () => {
    const { apiClient } = await load();
    const health = await loadSessionHealth();
    mocks.refreshTokens.mockResolvedValue('refreshed');
    fetchMock.mockImplementation(respond(401));
    const response = await apiClient.get('/api/devices');
    expect(response).toMatchObject({ status: 401, ok: false });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(health.getSessionHealth()).toBe('paused');
    expect(mocks.forceLogout).not.toHaveBeenCalled();
  });

  it('pauses on a transient refresh and keeps the session', async () => {
    const { apiClient } = await load();
    const health = await loadSessionHealth();
    mocks.refreshTokens.mockResolvedValue('transient');
    fetchMock.mockImplementation(respond(401));
    expect(await apiClient.get('/api/devices')).toMatchObject({ status: 0, ok: false });
    expect(health.getSessionHealth()).toBe('paused');
    expect(mocks.forceLogout).not.toHaveBeenCalled();
  });

  it('does not pause on a 401 from a request that skips auth', async () => {
    const { apiClient } = await load();
    const health = await loadSessionHealth();
    fetchMock.mockImplementation(respond(401));
    await apiClient.get('/api/login', { skipAuth: true });
    expect(health.getSessionHealth()).toBe('healthy');
  });

  it("does not pause on a tool proxy's own 401, relative or absolute", async () => {
    const { apiClient } = await load();
    const health = await loadSessionHealth();
    mocks.refreshTokens.mockResolvedValue('refreshed');
    fetchMock.mockImplementation(respond(401));
    await apiClient.get('https://tenant.example.com/tools/fleetmdm-server/api/v1/fleet/hosts/1');
    await apiClient.get('/tools/fleetmdm-server/api/v1/fleet/hosts/1');
    expect(health.getSessionHealth()).toBe('healthy');
  });

  it('keeps a rejected pause through unrelated 2xx responses', async () => {
    const { apiClient } = await load();
    const health = await loadSessionHealth();
    mocks.refreshTokens.mockResolvedValue('refreshed');
    fetchMock.mockImplementation(respond(401));
    await apiClient.get('/chat/graphql');
    expect(health.getSessionHealth()).toBe('paused');
    fetchMock.mockImplementation(respond(200));
    await apiClient.get('/api/me');
    expect(health.getSessionHealth()).toBe('paused');
  });

  it('resumes a transient pause on a 2xx', async () => {
    const { apiClient } = await load();
    const health = await loadSessionHealth();
    health.markSessionPaused('transient');
    fetchMock.mockImplementation(respond(200));
    await apiClient.get('/api/devices');
    expect(health.getSessionHealth()).toBe('healthy');
  });

  it('turns a 410 into gone, reports it, and answers every later request locally', async () => {
    const { apiClient } = await load();
    const health = await loadSessionHealth();
    fetchMock.mockImplementation(respond(410));
    expect(await apiClient.get('/api/devices')).toMatchObject({ status: 410, ok: false });
    expect(health.getSessionHealth()).toBe('gone');
    expect(await apiClient.post('/chat/graphql', { query: '{ x }' })).toMatchObject({ status: 410, ok: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mocks.refreshTokens).not.toHaveBeenCalled();
    expect(mocks.forceLogout).not.toHaveBeenCalled();
  });

  it('hands a JSON 410 back unchanged and does not short-circuit afterwards', async () => {
    const { apiClient } = await load();
    const health = await loadSessionHealth();
    fetchMock.mockImplementation(respond(410, 'application/json'));
    expect(await apiClient.get('/api/recordings/1')).toMatchObject({ status: 410, ok: false });
    expect(health.getSessionHealth()).toBe('healthy');
    await apiClient.get('/api/recordings/2');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('ignores a 410 from a host that is not the tenant gateway', async () => {
    const { apiClient } = await load();
    const health = await loadSessionHealth();
    fetchMock.mockImplementation(respond(410));
    expect(await apiClient.external('https://hub.example.com/video')).toMatchObject({ status: 410, ok: false });
    expect(health.getSessionHealth()).toBe('healthy');
    await apiClient.external('https://hub.example.com/video');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('counts an absolute URL on the tenant host as the gateway', async () => {
    const { apiClient } = await load();
    const health = await loadSessionHealth();
    fetchMock.mockImplementation(respond(410));
    await apiClient.external('https://tenant.example.com/api/devices');
    expect(health.getSessionHealth()).toBe('gone');
  });
});
