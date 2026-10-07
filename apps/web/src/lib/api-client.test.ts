import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  refreshTokens: vi.fn(),
  forceLogout: vi.fn(),
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
  getTokenEpoch: () => 1,
  isBearerAuthMode: () => true,
}));
vi.mock('./runtime-config', () => ({
  runtimeEnv: { tenantHostUrl: () => 'https://tenant.example.com', sharedHostUrl: () => '' },
}));

const UPGRADE_BODY = { code: 'CLIENT_UPGRADE_REQUIRED', minBundleVersion: '1.0.120', storeUrl: 'itms-apps://x' };

async function load() {
  vi.resetModules();
  const [{ apiClient }, versionCheck] = await Promise.all([import('./api-client'), import('./version-check')]);
  return { apiClient, versionCheck };
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
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
