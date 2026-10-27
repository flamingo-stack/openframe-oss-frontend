import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  me: vi.fn(),
  epoch: 1,
  link: null as ((online: boolean) => void) | null,
  resume: null as (() => void) | null,
}));

vi.mock('./api-client', () => ({ apiClient: { me: mocks.me } }));
vi.mock('./token-store', () => ({ getTokenEpoch: () => mocks.epoch, subscribeToTokenChange: () => () => undefined }));
vi.mock('./connectivity', () => ({
  subscribeConnectivity: (listener: (online: boolean) => void) => {
    mocks.link = listener;
    listener(true);
    return () => (mocks.link = null);
  },
}));
vi.mock('./native-shell', () => ({
  onAppResume: (callback: () => void) => {
    mocks.resume = callback;
    return () => (mocks.resume = null);
  },
}));

/** The link dropping and coming back, as `subscribeConnectivity` reports it. */
function linkReturns() {
  mocks.link?.(false);
  mocks.link?.(true);
}

const res = (status: number, type = 'text/html') => new Response('', { status, headers: { 'Content-Type': type } });

async function load() {
  vi.resetModules();
  const [health, probe] = await Promise.all([import('./session-health'), import('./session-revalidation')]);
  return { health, probe };
}

beforeEach(() => {
  vi.useFakeTimers();
  mocks.me.mockReset();
  mocks.me.mockResolvedValue({ ok: false, status: 401 });
  mocks.epoch = 1;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('session re-validation', () => {
  it('does nothing while healthy', async () => {
    const { probe } = await load();
    const stop = probe.startSessionRevalidation();
    await vi.advanceTimersByTimeAsync(probe.REVALIDATE_INTERVAL_MS * 2);
    document.dispatchEvent(new Event('visibilitychange'));
    linkReturns();
    mocks.resume?.();
    expect(mocks.me).not.toHaveBeenCalled();
    stop();
  });

  it('probes on a slow timer while paused, re-arming until the pause ends', async () => {
    const { health, probe } = await load();
    const stop = probe.startSessionRevalidation();
    health.markSessionPaused('rejected');
    await vi.advanceTimersByTimeAsync(probe.REVALIDATE_INTERVAL_MS - 1);
    expect(mocks.me).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(mocks.me).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(probe.REVALIDATE_INTERVAL_MS);
    expect(mocks.me).toHaveBeenCalledTimes(2);

    mocks.me.mockResolvedValue({ ok: true, status: 200 });
    await vi.advanceTimersByTimeAsync(probe.REVALIDATE_INTERVAL_MS);
    expect(mocks.me).toHaveBeenCalledTimes(3);
    expect(health.getSessionHealth()).toBe('healthy');
    await vi.advanceTimersByTimeAsync(probe.REVALIDATE_INTERVAL_MS * 3);
    expect(mocks.me).toHaveBeenCalledTimes(3);
    stop();
  });

  it('probes when the tab becomes visible or the link returns, no more often than the floor', async () => {
    const { health, probe } = await load();
    const stop = probe.startSessionRevalidation();
    health.markSessionPaused('rejected');
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.me).toHaveBeenCalledTimes(1);
    linkReturns();
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.me).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(probe.REVALIDATE_MIN_GAP_MS);
    linkReturns();
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.me).toHaveBeenCalledTimes(2);
    stop();
  });

  it('probes when the native app comes back to the foreground', async () => {
    const { health, probe } = await load();
    const stop = probe.startSessionRevalidation();
    health.markSessionPaused('rejected');
    mocks.resume?.();
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.me).toHaveBeenCalledTimes(1);
    stop();
  });

  it('does not count the link state reported on subscribe as the link coming back', async () => {
    const { health, probe } = await load();
    health.markSessionPaused('rejected');
    const stop = probe.startSessionRevalidation();
    mocks.link?.(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.me).not.toHaveBeenCalled();
    stop();
  });

  it('does not probe a hidden tab', async () => {
    const { health, probe } = await load();
    const stop = probe.startSessionRevalidation();
    health.markSessionPaused('rejected');
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.me).not.toHaveBeenCalled();
    stop();
  });

  it('does not probe once gone', async () => {
    const { health, probe } = await load();
    const stop = probe.startSessionRevalidation();
    health.markSessionPaused('rejected');
    health.noteGatewayResponse(res(410));
    await vi.advanceTimersByTimeAsync(probe.REVALIDATE_INTERVAL_MS * 2);
    linkReturns();
    expect(mocks.me).not.toHaveBeenCalled();
    stop();
  });

  it('clears a transient pause that predates a token rotation at start-up instead of probing', async () => {
    const { health, probe } = await load();
    health.markSessionPaused('transient');
    mocks.epoch = 2;
    const stop = probe.startSessionRevalidation();
    expect(health.getSessionHealth()).toBe('healthy');
    stop();
  });

  it('backs off when a rejection comes straight back after the probe resumed polling', async () => {
    const { health, probe } = await load();
    const stop = probe.startSessionRevalidation();
    health.markSessionPaused('rejected');
    mocks.me.mockResolvedValue({ ok: true, status: 200 });
    await vi.advanceTimersByTimeAsync(probe.REVALIDATE_INTERVAL_MS);
    expect(mocks.me).toHaveBeenCalledTimes(1);
    expect(health.getSessionHealth()).toBe('healthy');

    health.markSessionPaused('rejected'); // the refused path refuses again within seconds
    await vi.advanceTimersByTimeAsync(probe.REVALIDATE_INTERVAL_MS);
    expect(mocks.me).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(probe.REVALIDATE_INTERVAL_MS);
    expect(mocks.me).toHaveBeenCalledTimes(2);

    // A resume that holds past the window resets the interval.
    await vi.advanceTimersByTimeAsync(probe.RELAPSE_WINDOW_MS);
    health.markSessionPaused('rejected');
    await vi.advanceTimersByTimeAsync(probe.REVALIDATE_INTERVAL_MS);
    expect(mocks.me).toHaveBeenCalledTimes(3);
    stop();
  });

  it('does not re-arm when stopped while a probe is in flight', async () => {
    const { health, probe } = await load();
    let answer: (value: { ok: boolean; status: number }) => void = () => undefined;
    mocks.me.mockImplementation(
      () =>
        new Promise(resolve => {
          answer = resolve;
        }),
    );
    const stop = probe.startSessionRevalidation();
    health.markSessionPaused('rejected');
    await vi.advanceTimersByTimeAsync(probe.REVALIDATE_INTERVAL_MS);
    expect(mocks.me).toHaveBeenCalledTimes(1);

    stop();
    answer({ ok: false, status: 401 });
    await vi.advanceTimersByTimeAsync(probe.REVALIDATE_INTERVAL_MS * 3);
    expect(mocks.me).toHaveBeenCalledTimes(1);
  });

  it('keeps a rejected pause across a token rotation at start-up', async () => {
    const { health, probe } = await load();
    health.markSessionPaused('rejected');
    mocks.epoch = 2;
    const stop = probe.startSessionRevalidation();
    expect(health.getSessionHealth()).toBe('paused');
    stop();
  });
});
