/**
 * The page-level contract of `/auth/desktop-handoff`. Opened by the app (`#launch`), it asks the
 * gateway for this browser's download id, launches the app's scheme with it exactly once (without one
 * when the gateway has none or does not answer) and strips the marker. Any other load launches and
 * looks up nothing until the button is pressed. The button launches again.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const launch = vi.hoisted(() => vi.fn());
const client = vi.hoisted(() => ({ desktopDownloadHandoff: vi.fn() }));

vi.mock('@/lib/desktop-auth-return', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  launchDesktopApp: launch,
}));

vi.mock('@/lib/auth-api-client', () => ({ authApiClient: client }));

const DOWNLOAD_ID = '0f8fad5b-d9cb-469f-a165-70867728950e';
const OPENED_BY_APP = '/auth/desktop-handoff/#launch';

let root: Root;
let container: HTMLDivElement;

/**
 * The page reads its URL once per module instance, as once per page load: a fresh import per test.
 * StrictMode, as in the app. `seed` puts an answer in the cache before the first render, the one case
 * in which StrictMode's double-run mount effect meets a URL to launch, which the single-launch guard
 * is for.
 */
async function render(url: string, seed?: { downloadId: string | null }) {
  window.history.replaceState(null, '', url);
  vi.resetModules();
  const { default: DesktopHandoffPage } = await import('./page');
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (seed) queryClient.setQueryData(['desktop-download-handoff'], seed.downloadId);
  await act(async () => {
    root.render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <DesktopHandoffPage />
        </QueryClientProvider>
      </StrictMode>,
    );
  });
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
}

const button = () => container.querySelector('button');

// The first import transforms the whole core library, which on a cold cache takes most of a test's
// five seconds. Pay it once here, so each test's fresh import only re-evaluates.
beforeAll(async () => {
  await import('./page');
}, 60_000);

beforeEach(() => {
  container = document.createElement('div');
  root = createRoot(container);
  launch.mockReset();
  client.desktopDownloadHandoff.mockReset();
});

afterEach(() => {
  act(() => root.unmount());
});

describe('DesktopHandoffPage opened by the app', () => {
  it('launches the app once with the download id the gateway found, and strips the marker', async () => {
    client.desktopDownloadHandoff.mockResolvedValue({ ok: true, status: 200, data: { downloadId: DOWNLOAD_ID } });
    await render(OPENED_BY_APP);

    expect(launch.mock.calls).toEqual([[`openframe-console://download?id=${DOWNLOAD_ID}`]]);
    expect(client.desktopDownloadHandoff).toHaveBeenCalledTimes(1);
    expect(window.location.hash).toBe('');
    expect(window.location.pathname).toBe('/auth/desktop-handoff/');
    expect(container.textContent).toContain('Opening OpenFrame Console');
  });

  it('launches once when the answer is already there as it mounts', async () => {
    await render(OPENED_BY_APP, { downloadId: DOWNLOAD_ID });

    expect(launch).toHaveBeenCalledTimes(1);
  });

  it('launches it again from the button, with the same id', async () => {
    client.desktopDownloadHandoff.mockResolvedValue({ ok: true, status: 200, data: { downloadId: DOWNLOAD_ID } });
    await render(OPENED_BY_APP);

    expect(button()?.textContent).toBe('Return to OpenFrame Console');
    await act(async () => button()?.click());

    expect(launch.mock.calls).toEqual([
      [`openframe-console://download?id=${DOWNLOAD_ID}`],
      [`openframe-console://download?id=${DOWNLOAD_ID}`],
    ]);
    expect(client.desktopDownloadHandoff).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['the gateway found no cookie', { ok: true, status: 200, data: { downloadId: null } }],
    ['the gateway does not serve the hand-off', { ok: false, status: 404 }],
    ['the gateway answers an id that is not one', { ok: true, status: 200, data: { downloadId: 'not-a-uuid' } }],
    ['the lookup fails', { ok: false, status: 0, error: 'Network error' }],
  ])('takes the person back without an id when %s', async (_case, response) => {
    client.desktopDownloadHandoff.mockResolvedValue(response);
    await render(OPENED_BY_APP);

    expect(launch.mock.calls).toEqual([['openframe-console://download']]);
    expect(button()?.disabled).toBe(false);
  });

  it('launches nothing, and holds the button, until the gateway answers', async () => {
    client.desktopDownloadHandoff.mockReturnValue(new Promise(() => {}));
    await render(OPENED_BY_APP);

    expect(launch).not.toHaveBeenCalled();
    expect(button()?.disabled).toBe(true);
  });
});

describe('DesktopHandoffPage loaded any other way', () => {
  it('launches and looks up nothing on its own', async () => {
    await render('/auth/desktop-handoff/');

    expect(client.desktopDownloadHandoff).not.toHaveBeenCalled();
    expect(launch).not.toHaveBeenCalled();
    expect(button()?.disabled).toBe(false);
  });

  it('looks the id up and launches when the button is pressed', async () => {
    client.desktopDownloadHandoff.mockResolvedValue({ ok: true, status: 200, data: { downloadId: DOWNLOAD_ID } });
    await render('/auth/desktop-handoff/');

    await act(async () => button()?.click());
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(client.desktopDownloadHandoff).toHaveBeenCalledTimes(1);
    expect(launch.mock.calls).toEqual([[`openframe-console://download?id=${DOWNLOAD_ID}`]]);
  });
});
