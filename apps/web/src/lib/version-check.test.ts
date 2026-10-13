import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const env = vi.hoisted(() => ({
  mobile: true,
  platform: 'ios' as 'ios' | 'android' | null,
  shellVersion: '1.0.1' as string | null,
  bundleVersion: '1.0.130',
  sharedHost: 'https://auth.example.com/',
}));

vi.mock('./platform', () => ({
  isMobileShell: () => env.mobile,
  mobilePlatform: () => (env.mobile ? env.platform : null),
}));
vi.mock('./native-shell', () => ({ nativeShellVersion: () => Promise.resolve(env.shellVersion) }));
vi.mock('./client-identity', () => ({ clientBundleVersion: () => env.bundleVersion }));
vi.mock('./runtime-config', () => ({ runtimeEnv: { sharedHostUrl: () => env.sharedHost } }));

const POLICY = {
  minBundleVersion: '1.0.120',
  ios: { latestVersion: '1.0.2', storeUrl: 'itms-apps://apps.apple.com/app/id1' },
  android: { latestVersion: '1.0.3', storeUrl: 'market://details?id=ai.openframe.mobile' },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** Fresh module per test: the store and the in-flight guard live at module scope. */
async function load() {
  vi.resetModules();
  return import('./version-check');
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  Object.assign(env, {
    mobile: true,
    platform: 'ios',
    shellVersion: '1.0.1',
    bundleVersion: '1.0.130',
    sharedHost: 'https://auth.example.com/',
  });
  fetchMock = vi.fn(() => Promise.resolve(jsonResponse(POLICY)));
  vi.stubGlobal('fetch', fetchMock);
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('version policy', () => {
  it('is fetched from the shared host as a plain GET with no custom headers', async () => {
    const { refreshVersionPolicy } = await load();
    await refreshVersionPolicy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://auth.example.com/sas/mobile/version-policy');
    expect(init.headers).toBeUndefined();
    expect(init.method).toBeUndefined();
  });

  it('is never fetched off mobile', async () => {
    env.mobile = false;
    const { refreshVersionPolicy } = await load();
    await refreshVersionPolicy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('offers the nudge when the shell is behind the platform latest', async () => {
    const { refreshVersionPolicy, useAppUpdateStore } = await load();
    await refreshVersionPolicy();
    expect(useAppUpdateStore.getState().available).toBe('1.0.2');
    expect(useAppUpdateStore.getState().required).toBeNull();
  });

  it('reads the latest version of its own platform', async () => {
    env.platform = 'android';
    env.shellVersion = '1.0.2';
    const { refreshVersionPolicy, useAppUpdateStore } = await load();
    await refreshVersionPolicy();
    expect(useAppUpdateStore.getState().available).toBe('1.0.3');
  });

  it('offers nothing to a current shell, or one whose version is unknown', async () => {
    env.shellVersion = '1.0.2';
    let mod = await load();
    await mod.refreshVersionPolicy();
    expect(mod.useAppUpdateStore.getState().available).toBeNull();

    env.shellVersion = null;
    mod = await load();
    await mod.refreshVersionPolicy();
    expect(mod.useAppUpdateStore.getState().available).toBeNull();
  });

  it('snoozes the nudge for the dismissed version only', async () => {
    let mod = await load();
    await mod.refreshVersionPolicy();
    mod.dismissUpdateNudge();
    expect(mod.useAppUpdateStore.getState().available).toBeNull();

    await mod.refreshVersionPolicy();
    expect(mod.useAppUpdateStore.getState().available).toBeNull();

    fetchMock.mockImplementation(() =>
      Promise.resolve(jsonResponse({ ...POLICY, ios: { ...POLICY.ios, latestVersion: '1.0.4' } })),
    );
    mod = await load();
    await mod.refreshVersionPolicy();
    expect(mod.useAppUpdateStore.getState().available).toBe('1.0.4');
  });

  it('shows the nudge again once the snooze has run out', async () => {
    const mod = await load();
    await mod.refreshVersionPolicy();
    mod.dismissUpdateNudge();
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 25 * 60 * 60 * 1000);
    await mod.refreshVersionPolicy();
    expect(mod.useAppUpdateStore.getState().available).toBe('1.0.2');
  });

  it('requires the update when the bundle is below minBundleVersion', async () => {
    env.bundleVersion = '1.0.119-3-gabcdef0';
    const { refreshVersionPolicy, isUpdateRequired, resolveStoreUrl } = await load();
    await refreshVersionPolicy();
    expect(isUpdateRequired()).toBe(true);
    expect(resolveStoreUrl()).toBe(POLICY.ios.storeUrl);
  });

  it('does not require it for an unknown bundle version', async () => {
    env.bundleVersion = '-';
    const { refreshVersionPolicy, isUpdateRequired } = await load();
    await refreshVersionPolicy();
    expect(isUpdateRequired()).toBe(false);
  });

  it.each([
    ['a 5xx', () => Promise.resolve(jsonResponse({}, 503))],
    ['a network failure', () => Promise.reject(new TypeError('Load failed'))],
    ['a body that is not JSON', () => Promise.resolve(new Response('<html>', { status: 200 }))],
  ])('stays silent on %s', async (_label, impl) => {
    fetchMock.mockImplementation(impl);
    const { refreshVersionPolicy, useAppUpdateStore } = await load();
    await expect(refreshVersionPolicy()).resolves.toBeUndefined();
    expect(useAppUpdateStore.getState()).toMatchObject({ policy: null, available: null, required: null });
  });
});

describe('426 Upgrade Required', () => {
  it('flips the app into the blocking state with the body store URL', async () => {
    const { noteUpgradeRequired, isUpdateRequired, resolveStoreUrl } = await load();
    const response = jsonResponse({ code: 'CLIENT_UPGRADE_REQUIRED', storeUrl: 'itms-apps://from-426' }, 426);
    await expect(noteUpgradeRequired(response)).resolves.toBe(true);
    expect(isUpdateRequired()).toBe(true);
    expect(resolveStoreUrl()).toBe('itms-apps://from-426');
    // A clone was read: the caller still owns the body.
    expect(response.bodyUsed).toBe(false);
  });

  it('ignores every other status', async () => {
    const { noteUpgradeRequired, isUpdateRequired } = await load();
    await expect(noteUpgradeRequired(jsonResponse({}, 401))).resolves.toBe(false);
    await expect(noteUpgradeRequired(jsonResponse({}, 400))).resolves.toBe(false);
    expect(isUpdateRequired()).toBe(false);
  });

  it('is an ordinary failure off mobile', async () => {
    env.mobile = false;
    const { noteUpgradeRequired, isUpdateRequired } = await load();
    await expect(noteUpgradeRequired(jsonResponse({}, 426))).resolves.toBe(false);
    expect(isUpdateRequired()).toBe(false);
  });

  it('falls back to the cached policy, then to the published listing', async () => {
    let mod = await load();
    await mod.refreshVersionPolicy();
    await mod.noteUpgradeRequired(new Response('', { status: 426 }));
    expect(mod.resolveStoreUrl()).toBe(POLICY.ios.storeUrl);

    env.platform = 'android';
    mod = await load();
    await mod.noteUpgradeRequired(new Response('', { status: 426 }));
    expect(mod.resolveStoreUrl()).toBe('https://play.google.com/store/apps/details?id=ai.openframe.mobile');
  });

  it('refuses a store URL that is not a store scheme', async () => {
    const { noteUpgradeRequired, resolveStoreUrl } = await load();
    await noteUpgradeRequired(jsonResponse({ storeUrl: 'javascript:alert(1)' }, 426));
    expect(resolveStoreUrl()).toMatch(/^https:\/\/apps\.apple\.com\//);
  });
});
