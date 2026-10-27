import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ me: vi.fn(), epoch: 1 }));

vi.mock('./api-client', () => ({ apiClient: { me: mocks.me } }));
vi.mock('./token-store', () => ({ getTokenEpoch: () => mocks.epoch, subscribeToTokenChange: () => () => undefined }));

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
    window.dispatchEvent(new Event('online'));
    expect(mocks.me).not.toHaveBeenCalled();
    stop();
  });

  it('probes on a slow timer while paused, re-arming until the pause ends', async () => {
    const { health, probe } = await load();
    const stop = probe.startSessionRevalidation();
    health.markSessionPaused();
    await vi.advanceTimersByTimeAsync(probe.REVALIDATE_INTERVAL_MS - 1);
    expect(mocks.me).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(mocks.me).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(probe.REVALIDATE_INTERVAL_MS);
    expect(mocks.me).toHaveBeenCalledTimes(2);

    mocks.me.mockImplementation(async () => {
      health.noteGatewayResponse(res(200));
      return { ok: true, status: 200 };
    });
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
    health.markSessionPaused();
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.me).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.me).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(probe.REVALIDATE_MIN_GAP_MS);
    window.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.me).toHaveBeenCalledTimes(2);
    stop();
  });

  it('does not probe a hidden tab', async () => {
    const { health, probe } = await load();
    const stop = probe.startSessionRevalidation();
    health.markSessionPaused();
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.me).not.toHaveBeenCalled();
    stop();
  });

  it('does not probe once gone', async () => {
    const { health, probe } = await load();
    const stop = probe.startSessionRevalidation();
    health.markSessionPaused();
    health.noteGatewayResponse(res(410));
    await vi.advanceTimersByTimeAsync(probe.REVALIDATE_INTERVAL_MS * 2);
    window.dispatchEvent(new Event('online'));
    expect(mocks.me).not.toHaveBeenCalled();
    stop();
  });

  it('clears a pause that predates a token rotation at start-up instead of probing', async () => {
    const { health, probe } = await load();
    health.markSessionPaused();
    mocks.epoch = 2;
    const stop = probe.startSessionRevalidation();
    expect(health.getSessionHealth()).toBe('healthy');
    stop();
  });
});
