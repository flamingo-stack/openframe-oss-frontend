import { beforeEach, describe, expect, it, vi } from 'vitest';

type Pair = { accessToken?: string | null; refreshToken?: string | null };

const shell = vi.hoisted(() => ({
  getTokens: vi.fn<() => Promise<Pair>>(),
  setTenantHost: vi.fn<() => Promise<void>>(),
  storedHost: null as string | null,
  pushTokens: null as ((tokens: Pair) => void) | null,
}));

const platform = vi.hoisted(() => ({ appShell: true }));

vi.mock('@flamingo-stack/openframe-frontend-core/hooks', () => ({ clearAuthedImageCache: vi.fn() }));
vi.mock('./client-identity', () => ({ clientBundleVersion: () => '0.0.0' }));
vi.mock('./native-biometrics', () => ({
  BIOMETRIC_ERROR: { INVALIDATED: 'INVALIDATED', CANCELED: 'CANCELED' },
  isBiometricLoginEnabled: () => Promise.resolve(false),
}));
vi.mock('./native-shell', () => ({
  getStoredTenantHost: () => shell.storedHost,
  nativeAuthPlugin: () => ({
    getTokens: shell.getTokens,
    setTenantHost: shell.setTenantHost,
    clearTokens: () => Promise.resolve(),
  }),
  nativeErrorCode: (error: unknown) => (error as { code?: string } | undefined)?.code,
  onNativeTokenUpdate: (listener: (tokens: Pair) => void) => {
    shell.pushTokens = listener;
  },
}));
vi.mock('./platform', () => ({ isAppShell: () => platform.appShell }));
vi.mock('./runtime-config', () => ({
  runtimeEnv: { sharedHostUrl: () => '', enableDevTicketObserver: () => false },
}));

/** A fresh module per test: the cache, the epoch and the memoized hydration are module state. */
async function loadStore() {
  vi.resetModules();
  return import('./token-store');
}

/**
 * Cold-start hydration with the Keychain read still in flight: the test decides what happens meanwhile, then
 * answers or fails the read. The shell's push listener is registered before the read starts.
 */
async function startHydration() {
  let answer: (tokens: Pair) => void = () => {};
  let fail: (error: unknown) => void = () => {};
  shell.getTokens.mockReturnValue(
    new Promise((resolve, reject) => {
      answer = resolve;
      fail = reject;
    }),
  );
  const store = await loadStore();
  const hydration = store.initTokenStore();
  const changes = vi.fn();
  return {
    store,
    hydration,
    answer: (tokens: Pair) => answer(tokens),
    fail: (error: unknown) => fail(error),
    /** Count the token-change announcements from here on. */
    watch: () => {
      store.subscribeToTokenChange(changes);
      return changes;
    },
  };
}

beforeEach(() => {
  shell.getTokens.mockReset();
  shell.setTenantHost.mockReset().mockResolvedValue(undefined);
  shell.storedHost = null;
  shell.pushTokens = null;
  platform.appShell = true;
  localStorage.clear();
});

describe('cold-start hydration in a native shell', () => {
  it('announces the credential it installs, so what waits for the first one hears of it', async () => {
    shell.getTokens.mockResolvedValue({ accessToken: 'a1', refreshToken: 'r1' });
    const store = await loadStore();
    const changes = vi.fn();
    store.subscribeToTokenChange(changes);
    const epochBefore = store.getTokenEpoch();

    await store.initTokenStore();

    expect(store.getAccessTokenSync()).toBe('a1');
    expect(store.getTokenEpoch()).toBe(epochBefore + 1);
    expect(changes).toHaveBeenCalledTimes(1);
  });

  it('stays silent when the Keychain holds no session', async () => {
    shell.getTokens.mockResolvedValue({});
    const store = await loadStore();
    const changes = vi.fn();
    store.subscribeToTokenChange(changes);

    await store.initTokenStore();

    expect(store.getTokenEpoch()).toBe(0);
    expect(changes).not.toHaveBeenCalled();
  });

  it('does not announce the same credential twice when the shell pushed it first', async () => {
    const { store, hydration, answer, watch } = await startHydration();
    shell.pushTokens?.({ accessToken: 'a1', refreshToken: 'r1' });
    const epochAfterPush = store.getTokenEpoch();
    const changes = watch();

    answer({ accessToken: 'a1', refreshToken: 'r1' });
    await hydration;

    expect(store.getTokenEpoch()).toBe(epochAfterPush);
    expect(changes).not.toHaveBeenCalled();
  });

  it('keeps a pair the shell pushed while the Keychain was read, over the older pair the read returns', async () => {
    const { store, hydration, answer, watch } = await startHydration();
    shell.pushTokens?.({ accessToken: 'rotated', refreshToken: 'r2' });
    const epochAfterPush = store.getTokenEpoch();
    const changes = watch();

    answer({ accessToken: 'stale', refreshToken: 'r1' });
    await hydration;

    expect(store.getAccessTokenSync()).toBe('rotated');
    expect(store.getRefreshTokenSync()).toBe('r2');
    expect(store.getTokenEpoch()).toBe(epochAfterPush);
    expect(changes).not.toHaveBeenCalled();
  });

  it.each<[string, (store: Awaited<ReturnType<typeof loadStore>>) => Promise<void> | void]>([
    ['the shell pushes an empty pair', () => shell.pushTokens?.({})],
    ['the app signs out', store => store.clearTokens()],
  ])('does not bring back the pair it read when %s during the read', async (_, signOut) => {
    const { store, hydration, answer, watch } = await startHydration();
    await signOut(store);
    const changes = watch();

    answer({ accessToken: 'stale', refreshToken: 'r1' });
    await hydration;

    expect(store.getAccessTokenSync()).toBeNull();
    expect(changes).not.toHaveBeenCalled();
  });

  it('raises no lock over a pair the shell pushed while the Keychain read failed', async () => {
    const { store, hydration, fail } = await startHydration();
    shell.pushTokens?.({ accessToken: 'pushed', refreshToken: 'r1' });

    fail({ code: 'DEVICE_LOCKED' });
    await hydration;

    expect(store.getAccessTokenSync()).toBe('pushed');
    expect(store.getBiometricLockState()).toBeNull();
  });

  it('still locks when the read failed and nothing arrived meanwhile', async () => {
    const { store, hydration, fail } = await startHydration();

    fail({ code: 'DEVICE_LOCKED' });
    await hydration;

    expect(store.getAccessTokenSync()).toBeNull();
    expect(store.getBiometricLockState()).toBe('locked');
  });

  it('still locks when what arrived during the failed read was a sign-out, not a pair', async () => {
    const { store, hydration, fail } = await startHydration();
    shell.pushTokens?.({});

    fail({ code: 'CANCELED' });
    await hydration;

    expect(store.getBiometricLockState()).toBe('locked');
  });

  it('still forces a fresh login on an invalidated enrollment, whatever the shell pushed', async () => {
    const { store, hydration, fail } = await startHydration();
    shell.pushTokens?.({ accessToken: 'pushed', refreshToken: 'r1' });

    fail({ code: 'INVALIDATED' });
    await hydration;

    expect(store.getBiometricLockState()).toBe('invalidated');
  });

  it('counts a pair pushed while the tenant host was handed to the shell, before the read began', async () => {
    shell.storedHost = 'https://acme.example';
    let hostHandedOver: () => void = () => {};
    shell.setTenantHost.mockReturnValue(new Promise(resolve => (hostHandedOver = () => resolve())));
    shell.getTokens.mockRejectedValue({ code: 'CANCELED' });
    const store = await loadStore();
    const hydration = store.initTokenStore();
    shell.pushTokens?.({ accessToken: 'pushed', refreshToken: 'r1' });

    hostHandedOver();
    await hydration;

    expect(store.getAccessTokenSync()).toBe('pushed');
    expect(store.getBiometricLockState()).toBeNull();
  });
});

describe('a lock raised at launch, then a push from the shell', () => {
  async function lockedAtLaunch() {
    const { store, hydration, fail } = await startHydration();
    fail({ code: 'DEVICE_LOCKED' });
    await hydration;
    expect(store.getBiometricLockState()).toBe('locked');
    return store;
  }

  it('lifts the lock when the shell pushes a pair after the device is unlocked', async () => {
    const store = await lockedAtLaunch();
    const lockChanges = vi.fn();
    store.subscribeToBiometricLock(lockChanges);

    shell.pushTokens?.({ accessToken: 'a1', refreshToken: 'r1' });

    expect(store.getAccessTokenSync()).toBe('a1');
    expect(store.getBiometricLockState()).toBeNull();
    expect(lockChanges).toHaveBeenCalledWith(null);
  });

  it('stays locked when the shell pushes an empty pair', async () => {
    const store = await lockedAtLaunch();

    shell.pushTokens?.({});

    expect(store.getBiometricLockState()).toBe('locked');
  });
});

describe('the bearer token for request headers', () => {
  it('is the access token the shell hydrated', async () => {
    shell.getTokens.mockResolvedValue({ accessToken: 'a1', refreshToken: 'r1' });
    const store = await loadStore();

    await store.initTokenStore();

    expect(store.getBearerTokenSync()).toBe('a1');
  });

  it('is none on cookie-auth web, even with an access token left in localStorage', async () => {
    platform.appShell = false;
    const store = await loadStore();
    localStorage.setItem(store.ACCESS_TOKEN_KEY, 'leftover');

    expect(store.getBearerTokenSync()).toBeNull();
  });
});
