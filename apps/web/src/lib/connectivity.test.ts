import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./native-shell', () => ({ networkPlugin: () => null }));
vi.mock('./platform', () => ({ isAppShell: () => false }));
vi.mock('./runtime-config', () => ({ runtimeEnv: { tenantHostUrl: () => 'https://tenant.example' } }));

const fetchMock = vi.fn<typeof fetch>();
let navigatorOnline = true;

async function subscribe() {
  vi.resetModules();
  const { subscribeConnectivity } = await import('./connectivity');
  const seen: boolean[] = [];
  subscribeConnectivity(online => seen.push(online));
  return seen;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => navigatorOnline);
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  fetchMock.mockReset();
  navigatorOnline = true;
});

describe('connectivity', () => {
  it('stays online when the platform reports offline but the gateway answers', async () => {
    navigatorOnline = false;
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));

    const seen = await subscribe();
    await vi.advanceTimersByTimeAsync(0);

    expect(fetchMock).toHaveBeenCalledWith('https://tenant.example/', expect.objectContaining({ mode: 'no-cors' }));
    expect(seen).toEqual([true]);
  });

  it('goes offline when the gateway does not answer, and back once it does', async () => {
    navigatorOnline = false;
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const seen = await subscribe();
    await vi.advanceTimersByTimeAsync(0);
    expect(seen).toEqual([true, false]);

    // The platform never fires `online`; the re-probe alone lifts it.
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    await vi.advanceTimersByTimeAsync(10_000);
    expect(seen).toEqual([true, false, true]);
  });

  it('drops a probe answer once the platform has reported again', async () => {
    navigatorOnline = false;
    let fail: (error: Error) => void = () => undefined;
    fetchMock.mockReturnValue(new Promise((_, reject) => (fail = reject)));

    const seen = await subscribe();
    window.dispatchEvent(new Event('online'));
    fail(new TypeError('Failed to fetch'));
    await vi.advanceTimersByTimeAsync(0);

    expect(seen).toEqual([true]);
  });
});
