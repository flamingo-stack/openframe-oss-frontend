import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const shell = vi.hoisted(() => ({
  kind: 'web' as 'web' | 'mobile' | 'desktop',
  platform: null as 'ios' | 'android' | null,
  version: null as string | null,
}));

vi.mock('./platform', () => ({
  shellKind: () => shell.kind,
  mobilePlatform: () => shell.platform,
}));

vi.mock('./native-shell', () => ({
  nativeShellVersion: () => Promise.resolve(shell.version),
}));

/** Fresh module per test: the bundle version is read, and the shell version cached, at module scope. */
async function load(bundleVersion: string | undefined) {
  vi.stubEnv('OPENFRAME_BUNDLE_VERSION', bundleVersion);
  vi.resetModules();
  return import('./client-identity');
}

describe('X-OpenFrame-Client', () => {
  beforeEach(() => {
    shell.kind = 'web';
    shell.platform = null;
    shell.version = null;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reports the web with no shell version', async () => {
    const { clientIdentityHeaders } = await load('1.0.127');
    expect(clientIdentityHeaders()).toEqual({ 'X-OpenFrame-Client': 'web/- bundle/1.0.127' });
  });

  it('reports `-` when the build carried no version', async () => {
    const { clientIdentityValue } = await load(undefined);
    expect(clientIdentityValue()).toBe('web/- bundle/-');
  });

  it('reports `-` for a version the backend would reject', async () => {
    const { clientIdentityValue } = await load('1.0.127-with-a-description-past-32-chars');
    expect(clientIdentityValue()).toBe('web/- bundle/-');
  });

  it('names the phone OS and picks up the shell version once primed', async () => {
    shell.kind = 'mobile';
    shell.platform = 'ios';
    shell.version = '1.0.1';
    const { clientIdentityValue, primeShellVersion } = await load('1.0.127');

    expect(clientIdentityValue()).toBe('ios/- bundle/1.0.127');
    primeShellVersion();
    await vi.waitFor(() => expect(clientIdentityValue()).toBe('ios/1.0.1 bundle/1.0.127'));
  });

  it('reports the desktop shell', async () => {
    shell.kind = 'desktop';
    shell.version = '0.4.2';
    const { clientIdentityValue, primeShellVersion } = await load('1.0.125-4-geae0416-dirty');

    primeShellVersion();
    await vi.waitFor(() => expect(clientIdentityValue()).toBe('desktop/0.4.2 bundle/1.0.125-4-geae0416-dirty'));
  });

  it('keeps a malformed native version from producing an invalid header', async () => {
    shell.kind = 'mobile';
    shell.platform = 'android';
    shell.version = '1.0 beta\n2';
    const { clientIdentityValue, primeShellVersion } = await load('1.0.127');

    primeShellVersion();
    // A rejected value reads the same `-` as not-yet-primed: flush the bridge promise first.
    await Promise.resolve();
    await Promise.resolve();
    expect(clientIdentityValue()).toBe('android/- bundle/1.0.127');
    expect(() => new Headers({ 'X-OpenFrame-Client': clientIdentityValue() })).not.toThrow();
  });
});
