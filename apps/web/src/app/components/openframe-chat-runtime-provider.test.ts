import type { AuthedAsset } from '@flamingo-stack/openframe-frontend-core/hooks';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { runtimeEnv } from '@/lib/runtime-config';

const mocks = vi.hoisted(() => ({
  mobile: true,
  refreshAccessToken: vi.fn(),
}));

const TENANT_HOST = vi.hoisted(() => 'https://tenant.example.com');

// One gateway for both ends of a picture: the origin the adapter sanctions for the bearer (read at module load) and
// the host a backend image path resolves to.
vi.mock('@/lib/runtime-config', async importOriginal => {
  const actual = await importOriginal<{ runtimeEnv: typeof runtimeEnv }>();
  return { ...actual, runtimeEnv: { ...actual.runtimeEnv, tenantHostUrl: () => TENANT_HOST } };
});

vi.mock('@/lib/platform', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  isMobileShell: () => mocks.mobile,
  mobilePlatform: () => (mocks.mobile ? 'ios' : null),
}));
vi.mock('@/lib/token-refresh-manager', () => ({ refreshAccessToken: mocks.refreshAccessToken }));
vi.mock('@/lib/token-store', () => ({
  getBearerTokenSync: () => 'token',
  getTokenEpoch: () => 1,
  isBearerAuthMode: () => true,
  subscribeToTokenChange: () => () => {},
}));

const UPGRADE_BODY = { code: 'CLIENT_UPGRADE_REQUIRED', minBundleVersion: '1.0.120', storeUrl: 'itms-apps://x' };

/**
 * The provider registers the app's auth adapter (`lib/embed-auth-adapter.ts`) at its module load; the chat's
 * requests go through the lib's `embedAuthedFetch`.
 */
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

// The first import transforms the whole inlined core lib, which can exceed vitest's 5s default test timeout:
// pay it once, outside every test's timeout, so each `load()` only re-evaluates. Loading registers the adapter.
beforeAll(async () => {
  await load();
  const { setEmbedAuthAdapter } = await import('@flamingo-stack/openframe-frontend-core/utils');
  setEmbedAuthAdapter(null);
}, 60_000);

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
  it('flips the update state and fails the request', async () => {
    const { embedAuthedFetch, versionCheck } = await load();
    await expect(embedAuthedFetch('/content/api/docs/commands')).rejects.toBeInstanceOf(
      versionCheck.UpdateRequiredError,
    );
    expect(versionCheck.isUpdateRequired()).toBe(true);
    expect(versionCheck.resolveStoreUrl()).toBe('itms-apps://x');
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
    await expect(embedAuthedFetch('/content/api/docs/commands')).rejects.toBeInstanceOf(
      versionCheck.UpdateRequiredError,
    );
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

describe('embed auth adapter in bearer mode', () => {
  const BLOB_URL = 'blob:avatar';
  const withBearer = expect.objectContaining({
    headers: expect.objectContaining({ Authorization: 'Bearer token' }),
  });
  let root: Root | null = null;

  beforeEach(() => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response(new Uint8Array([137, 80, 78, 71]), { headers: { 'Content-Type': 'image/png' } })),
    );
    URL.createObjectURL = vi.fn(() => BLOB_URL);
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = null;
  });

  it('sends the stored bearer with a chat request', async () => {
    const { embedAuthedFetch } = await load();
    await embedAuthedFetch('/content/api/docs/commands');
    expect(fetchMock).toHaveBeenCalledWith('/content/api/docs/commands', withBearer);
  });

  it("draws an avatar's backend path from the gateway, fetched with the bearer", async () => {
    await load();
    const { useAuthedImage } = await import('@flamingo-stack/openframe-frontend-core/hooks');
    let avatar: AuthedAsset | undefined;
    function Avatar() {
      avatar = useAuthedImage('/images/user/1');
      return null;
    }
    root = createRoot(document.createElement('div'));
    act(() => root?.render(createElement(Avatar)));

    await vi.waitFor(async () => {
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });
      expect(avatar).toMatchObject({ status: 'ready', src: BLOB_URL });
    });
    expect(fetchMock).toHaveBeenCalledWith(`${TENANT_HOST}/api/images/user/1`, withBearer);
  });
});
