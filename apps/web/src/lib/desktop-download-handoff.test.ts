/**
 * When the desktop app opens the gateway's download hand-off in the browser: once per install and
 * shared host, on an install nobody has signed in on and that holds no download id yet.
 */

import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { DOWNLOAD_HANDOFF_STARTED_KEY, startDownloadHandoff } from './desktop-download-handoff';

const env = vi.hoisted(() => ({
  desktop: true,
  sharedHost: 'https://openframe.ai',
  tokens: false,
  tenantHost: null as string | null,
  downloadId: false,
}));

vi.mock('./platform', () => ({ isDesktopShell: () => env.desktop }));
vi.mock('./runtime-config', () => ({ runtimeEnv: { sharedHostUrl: () => env.sharedHost } }));
vi.mock('./token-store', () => ({ hasTokensSync: () => env.tokens }));
vi.mock('./native-shell', () => ({ getStoredTenantHost: () => env.tenantHost }));
vi.mock('./registration-attribution', () => ({ hasStoredDownloadId: () => env.downloadId }));

const HANDOFF_URL = 'https://openframe.ai/v0/api/assets/download/handoff';

let open: MockInstance<typeof window.open>;

beforeEach(() => {
  env.desktop = true;
  env.sharedHost = 'https://openframe.ai';
  env.tokens = false;
  env.tenantHost = null;
  env.downloadId = false;
  window.localStorage.clear();
  open = vi.spyOn(window, 'open').mockReturnValue(null);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('startDownloadHandoff', () => {
  it('opens the hand-off in the browser on a fresh install, and marks it with the shared host', () => {
    expect(startDownloadHandoff()).toBe(true);
    expect(open).toHaveBeenCalledWith(HANDOFF_URL, '_blank', 'noopener,noreferrer');
    expect(window.localStorage.getItem(DOWNLOAD_HANDOFF_STARTED_KEY)).toBe('https://openframe.ai');
  });

  it('opens it once per install', () => {
    startDownloadHandoff();
    expect(startDownloadHandoff()).toBe(false);
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('opens it again once the install is pointed at another shared host', () => {
    startDownloadHandoff();
    env.sharedHost = 'https://openframe.miami';
    expect(startDownloadHandoff()).toBe(true);
    expect(open).toHaveBeenLastCalledWith(
      'https://openframe.miami/v0/api/assets/download/handoff',
      '_blank',
      'noopener,noreferrer',
    );
    expect(startDownloadHandoff()).toBe(false);
  });

  it('drops a trailing slash from the shared host, in the URL and in the mark', () => {
    env.sharedHost = 'https://openframe.ai/';
    startDownloadHandoff();
    expect(open).toHaveBeenCalledWith(HANDOFF_URL, '_blank', 'noopener,noreferrer');
    env.sharedHost = 'https://openframe.ai';
    expect(startDownloadHandoff()).toBe(false);
  });

  it.each([
    ['outside the desktop shell', () => (env.desktop = false)],
    ['without a shared host', () => (env.sharedHost = '')],
    ['with a session', () => (env.tokens = true)],
    ['on an install someone has signed in on', () => (env.tenantHost = 'https://acme.openframe.ai')],
    ['when a link already brought a download id', () => (env.downloadId = true)],
  ])('does nothing %s, and leaves no mark', (_case, arrange) => {
    arrange();
    expect(startDownloadHandoff()).toBe(false);
    expect(open).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(DOWNLOAD_HANDOFF_STARTED_KEY)).toBeNull();
  });

  it('does nothing when the mark cannot be stored', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(startDownloadHandoff()).toBe(false);
    expect(open).not.toHaveBeenCalled();
  });
});
