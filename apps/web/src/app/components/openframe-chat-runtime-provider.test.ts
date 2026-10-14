import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  mobile: true,
  refreshAccessToken: vi.fn(),
}));

vi.mock('@/lib/platform', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  isMobileShell: () => mocks.mobile,
  mobilePlatform: () => (mocks.mobile ? 'ios' : null),
}));
vi.mock('@/lib/token-refresh-manager', () => ({ refreshAccessToken: mocks.refreshAccessToken }));
vi.mock('@/lib/token-store', () => ({
  getAccessTokenSync: () => 'token',
  getTokenEpoch: () => 1,
  isBearerAuthMode: () => true,
  subscribeToTokenChange: () => () => {},
}));

const UPGRADE_BODY = { code: 'CLIENT_UPGRADE_REQUIRED', minBundleVersion: '1.0.120', storeUrl: 'itms-apps://x' };

/** The provider registers its adapter at module load; the chat's requests go through the lib's `embedAuthedFetch`. */
async function load() {
  vi.resetModules();
  await import('./openframe-chat-runtime-provider');
  const [{ embedAuthedFetch }, versionCheck] = await Promise.all([
    import('@flamingo-stack/openframe-frontend-core/utils'),
    import('@/lib/version-check'),
  ]);
  return { embedAuthedFetch, versionCheck };
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  mocks.mobile = true;
  mocks.refreshAccessToken.mockReset().mockResolvedValue(true);
  fetchMock = vi.fn(() =>
    Promise.resolve(
      new Response(JSON.stringify(UPGRADE_BODY), { status: 426, headers: { 'Content-Type': 'application/json' } }),
    ),
  );
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(async () => {
  const { setEmbedAuthAdapter } = await import('@flamingo-stack/openframe-frontend-core/utils');
  setEmbedAuthAdapter(null);
  vi.unstubAllGlobals();
});

describe('embedded chat on 426', () => {
  it('flips the update state and fails the request, never touching the session', async () => {
    const { embedAuthedFetch, versionCheck } = await load();
    await expect(embedAuthedFetch('/content/api/docs/commands')).rejects.toBeInstanceOf(
      versionCheck.UpdateRequiredError,
    );
    expect(versionCheck.isUpdateRequired()).toBe(true);
    expect(versionCheck.resolveStoreUrl()).toBe('itms-apps://x');
    expect(mocks.refreshAccessToken).not.toHaveBeenCalled();
  });

  it('catches a 426 on the retry after a 401 refresh', async () => {
    fetchMock.mockResolvedValueOnce(new Response('nope', { status: 401 }));
    const { embedAuthedFetch, versionCheck } = await load();
    await expect(embedAuthedFetch('/content/api/docs/commands')).rejects.toBeInstanceOf(
      versionCheck.UpdateRequiredError,
    );
    expect(versionCheck.isUpdateRequired()).toBe(true);
    expect(mocks.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('refuses every later request locally, so no retry reaches the wire', async () => {
    const { embedAuthedFetch, versionCheck } = await load();
    await embedAuthedFetch('/content/api/docs/commands').catch(() => {});
    await expect(embedAuthedFetch('/content/api/tickets/stream')).rejects.toBeInstanceOf(
      versionCheck.UpdateRequiredError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('is an ordinary failed response off the mobile shell', async () => {
    mocks.mobile = false;
    const { embedAuthedFetch, versionCheck } = await load();
    const response = await embedAuthedFetch('/content/api/docs/commands');
    expect(response.status).toBe(426);
    expect(versionCheck.isUpdateRequired()).toBe(false);
  });
});
