/**
 * The bundle's half of the mobile over-the-air updater, against the real `native-shell` and
 * `platform` over the globals a shell injects. Pinned: a downloaded bundle reports ready only on
 * a shell it can work with (the shell reverts one that never does), and every call is a no-op
 * where there is no updater: an older store build, the desktop shell, the browser.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

type Plugin = Record<string, unknown>;

const CORE_MEMBERS = [
  ['NativeAuth', 'start'],
  ['NativeAuth', 'exchangeTicket'],
  ['NativeAuth', 'getTokens'],
  ['NativeAuth', 'setTokens'],
  ['NativeAuth', 'clearTokens'],
  ['SplashScreen', 'hide'],
  ['App', 'getInfo'],
] as const;

function corePlugins(): Record<string, Plugin> {
  const plugins: Record<string, Plugin> = {};
  for (const [plugin, method] of CORE_MEMBERS) {
    plugins[plugin] = { ...plugins[plugin], [method]: vi.fn() };
  }
  return plugins;
}

const shellWindow = window as unknown as Record<string, unknown>;

/** Fresh module registry per test: `platform.ts` memoizes the shell kind. */
async function loadOnMobile(plugins: Record<string, Plugin>) {
  vi.resetModules();
  shellWindow.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios', Plugins: plugins };
  return import('./native-update');
}

afterEach(() => {
  delete shellWindow.Capacitor;
  delete shellWindow.__TAURI_INTERNALS__;
  vi.restoreAllMocks();
});

describe('confirmBundleBooted', () => {
  it('reports ready once when the shell has the whole core surface', async () => {
    const notifyReady = vi.fn(() => Promise.resolve({}));
    const { confirmBundleBooted } = await loadOnMobile({ ...corePlugins(), NativeUpdate: { notifyReady } });

    await confirmBundleBooted();

    expect(notifyReady).toHaveBeenCalledTimes(1);
  });

  it('reports before its first await, so a caller can put it ahead of token hydration', async () => {
    const notifyReady = vi.fn(() => Promise.resolve({}));
    const { confirmBundleBooted } = await loadOnMobile({ ...corePlugins(), NativeUpdate: { notifyReady } });

    void confirmBundleBooted();

    expect(notifyReady).toHaveBeenCalledTimes(1);
  });

  it.each(CORE_MEMBERS)('withholds the report when the shell lacks %s.%s', async (plugin, method) => {
    const notifyReady = vi.fn(() => Promise.resolve({}));
    const plugins = corePlugins();
    delete plugins[plugin][method];
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { confirmBundleBooted } = await loadOnMobile({ ...plugins, NativeUpdate: { notifyReady } });

    await confirmBundleBooted();

    expect(notifyReady).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0][0]).toContain(`${plugin}.${method}`);
  });

  it('names every missing member in one message when a whole plugin is absent', async () => {
    const notifyReady = vi.fn(() => Promise.resolve({}));
    const plugins = corePlugins();
    delete plugins.NativeAuth;
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { confirmBundleBooted } = await loadOnMobile({ ...plugins, NativeUpdate: { notifyReady } });

    await confirmBundleBooted();

    expect(notifyReady).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0][0]).toContain(
      'NativeAuth.start, NativeAuth.exchangeTicket, NativeAuth.getTokens, NativeAuth.setTokens, NativeAuth.clearTokens',
    );
  });

  it('does nothing on a shell that predates the updater, core surface missing or not', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect((await loadOnMobile(corePlugins())).confirmBundleBooted()).resolves.toBeUndefined();
    await expect((await loadOnMobile({})).confirmBundleBooted()).resolves.toBeUndefined();

    expect(error).not.toHaveBeenCalled();
  });

  it('does nothing on the desktop shell and in the browser, whatever sits on window.Capacitor', async () => {
    const notifyReady = vi.fn(() => Promise.resolve({}));
    const plugins = { ...corePlugins(), NativeUpdate: { notifyReady } };

    vi.resetModules();
    shellWindow.Capacitor = { isNativePlatform: () => true, Plugins: plugins };
    shellWindow.__TAURI_INTERNALS__ = {};
    await (await import('./native-update')).confirmBundleBooted();

    vi.resetModules();
    delete shellWindow.__TAURI_INTERNALS__;
    shellWindow.Capacitor = { isNativePlatform: () => false, Plugins: plugins };
    await (await import('./native-update')).confirmBundleBooted();

    expect(notifyReady).not.toHaveBeenCalled();
  });

  it.each([
    ['rejects', () => Promise.reject(new Error('bridge gone'))],
    [
      'throws',
      () => {
        throw new Error('bridge gone');
      },
    ],
  ])('swallows and logs a notifyReady that %s', async (_label, notifyReady) => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { confirmBundleBooted } = await loadOnMobile({ ...corePlugins(), NativeUpdate: { notifyReady } });

    await expect(confirmBundleBooted()).resolves.toBeUndefined();

    expect(error).toHaveBeenCalledTimes(1);
  });
});

describe('the updater state', () => {
  const FULL = {
    enabled: true,
    builtinVersion: '1.0.219',
    bridgeLevel: 1,
    bootedVersion: '1.0.220',
    trial: true,
    activeVersion: '1.0.220',
    pendingVersion: '1.0.221',
  };

  it('is passed through as the shell reports it', async () => {
    const { readUpdateState } = await loadOnMobile({ NativeUpdate: { getState: () => Promise.resolve(FULL) } });
    await expect(readUpdateState()).resolves.toEqual(FULL);
  });

  it('reads a field missing from the shell answer as null', async () => {
    const sparse = { enabled: true, builtinVersion: '1.0.219', bridgeLevel: 1, trial: false };
    const { readUpdateState } = await loadOnMobile({ NativeUpdate: { getState: () => Promise.resolve(sparse) } });

    await expect(readUpdateState()).resolves.toEqual({
      ...sparse,
      bootedVersion: null,
      activeVersion: null,
      pendingVersion: null,
    });
  });

  it('comes from check() when a check is asked for', async () => {
    const getState = vi.fn();
    const check = vi.fn(() => Promise.resolve(FULL));
    const { checkForUpdate } = await loadOnMobile({ NativeUpdate: { getState, check } });

    await expect(checkForUpdate()).resolves.toEqual(FULL);

    expect(check).toHaveBeenCalledTimes(1);
    expect(getState).not.toHaveBeenCalled();
  });

  it('is null without an updater, without the method, and when the call fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    let mod = await loadOnMobile({});
    await expect(mod.readUpdateState()).resolves.toBeNull();
    await expect(mod.checkForUpdate()).resolves.toBeNull();

    mod = await loadOnMobile({ NativeUpdate: { notifyReady: vi.fn() } });
    await expect(mod.readUpdateState()).resolves.toBeNull();
    await expect(mod.checkForUpdate()).resolves.toBeNull();

    const failing = () => Promise.reject(new Error('bridge gone'));
    mod = await loadOnMobile({ NativeUpdate: { getState: failing, check: failing } });
    await expect(mod.readUpdateState()).resolves.toBeNull();
    await expect(mod.checkForUpdate()).resolves.toBeNull();
  });
});

describe('restartIntoPendingUpdate', () => {
  it('asks the shell to swap to the pending bundle', async () => {
    const applyPending = vi.fn(() => Promise.resolve({}));
    const { restartIntoPendingUpdate } = await loadOnMobile({ NativeUpdate: { applyPending } });

    await expect(restartIntoPendingUpdate()).resolves.toBe(true);

    expect(applyPending).toHaveBeenCalledTimes(1);
  });

  it('answers false when the shell has no pending bundle to boot', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const applyPending = vi.fn(() =>
      Promise.reject(Object.assign(new Error('nothing to apply'), { code: 'NO_PENDING' })),
    );
    const { restartIntoPendingUpdate } = await loadOnMobile({ NativeUpdate: { applyPending } });

    await expect(restartIntoPendingUpdate()).resolves.toBe(false);

    expect(error.mock.calls[0][1]).toBe('NO_PENDING');
  });

  it('answers false on a shell without the updater', async () => {
    const { restartIntoPendingUpdate } = await loadOnMobile({});
    await expect(restartIntoPendingUpdate()).resolves.toBe(false);
  });
});
