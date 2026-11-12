/**
 * The download hand-off's two sides. The app opens the hand-off page in the browser once per install
 * and shared host, on an install nobody has signed in on and that holds no download id yet. The page
 * reads the id the gateway found, and builds the link back to the app.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import {
  desktopDownloadAppUrl,
  DOWNLOAD_HANDOFF_STARTED_KEY,
  lookUpHandoffDownloadId,
  startDownloadHandoff,
} from './desktop-download-handoff';

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
vi.mock('./registration-attribution', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  hasStoredDownloadId: () => env.downloadId,
}));
const client = vi.hoisted(() => ({ desktopDownloadHandoff: vi.fn() }));
vi.mock('./auth-api-client', () => ({ authApiClient: client }));

const HANDOFF_URL = 'https://openframe.ai/auth/desktop-handoff/#launch';
const DOWNLOAD_ID = '0f8fad5b-d9cb-469f-a165-70867728950e';

let open: MockInstance<typeof window.open>;

beforeEach(() => {
  env.desktop = true;
  env.sharedHost = 'https://openframe.ai';
  env.tokens = false;
  env.tenantHost = null;
  env.downloadId = false;
  client.desktopDownloadHandoff.mockReset();
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
      'https://openframe.miami/auth/desktop-handoff/#launch',
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

describe('lookUpHandoffDownloadId', () => {
  it('is the id the gateway found, lowercased', async () => {
    client.desktopDownloadHandoff.mockResolvedValue({
      ok: true,
      status: 200,
      data: { downloadId: DOWNLOAD_ID.toUpperCase() },
    });
    await expect(lookUpHandoffDownloadId()).resolves.toBe(DOWNLOAD_ID);
    expect(client.desktopDownloadHandoff.mock.calls[0][0]).toBeInstanceOf(AbortSignal);
  });

  it('gives the gateway five seconds, then answers null', async () => {
    const controller = new AbortController();
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal);
    client.desktopDownloadHandoff.mockImplementation(
      (signal: AbortSignal) =>
        new Promise(settle => {
          signal.addEventListener('abort', () => settle({ ok: false, status: 0, error: 'aborted' }));
        }),
    );

    const answer = lookUpHandoffDownloadId();
    expect(timeout).toHaveBeenCalledWith(5000);
    expect(client.desktopDownloadHandoff).toHaveBeenCalledWith(controller.signal);
    controller.abort();
    await expect(answer).resolves.toBeNull();
  });

  it.each([
    ['no cookie', { ok: true, status: 200, data: { downloadId: null } }],
    ['an id that is not a UUID', { ok: true, status: 200, data: { downloadId: 'not-a-uuid' } }],
    ['no body', { ok: true, status: 200 }],
    ['a gateway without the endpoint', { ok: false, status: 404 }],
    ['a failed request', { ok: false, status: 0, error: 'Network error' }],
  ])('is null for %s', async (_case, response) => {
    client.desktopDownloadHandoff.mockResolvedValue(response);
    await expect(lookUpHandoffDownloadId()).resolves.toBeNull();
  });
});

describe('desktopDownloadAppUrl', () => {
  it("is the shell's download link, with the id when there is one", () => {
    expect(desktopDownloadAppUrl(DOWNLOAD_ID)).toBe(`openframe-console://download?id=${DOWNLOAD_ID}`);
    expect(desktopDownloadAppUrl(null)).toBe('openframe-console://download');
  });

  it('uses the host the shell routes to its download link handler', () => {
    // Drift between this page and download_link.rs would launch the app with a link it ignores.
    const shell = readFileSync(resolve(import.meta.dirname, '../../../desktop/src-tauri/src/download_link.rs'), 'utf8');
    const host = /const HOST: &str = "([^"]+)";/.exec(shell)?.[1];
    expect(new URL(desktopDownloadAppUrl(null)).host).toBe(host);
  });
});
