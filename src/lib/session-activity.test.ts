import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The asymmetry is the point: a too-generous "active" cancels a push permanently,
 * so the cancel threshold must bite well before the presence one.
 */
describe('session-activity', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  async function load() {
    vi.doMock('./platform', () => ({ isMobileShell: () => false }));
    vi.doMock('./native-shell', () => ({ appPlugin: () => null }));
    return import('./session-activity');
  }

  it('keeps the attention window far tighter than the presence one', async () => {
    const { ATTENTION_IDLE_MS, PRESENCE_IDLE_MS } = await load();
    // Attention gates two irreversible actions (auto-read retracts cross-device, a
    // cancelled push is never re-armed), so it must bite long before presence, which
    // only costs a skipped grace window.
    expect(ATTENTION_IDLE_MS).toBeLessThan(PRESENCE_IDLE_MS);
    expect(ATTENTION_IDLE_MS).toBeLessThanOrEqual(15_000);
  });

  it('is active on a focused window and goes idle only after the threshold', async () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);
    const { isSessionActive, ATTENTION_IDLE_MS, PRESENCE_IDLE_MS } = await load();

    expect(isSessionActive({ idleAfterMs: ATTENTION_IDLE_MS })).toBe(true);

    // Past the attention window, still inside the presence window: the tight gate
    // closes first, so auto-read and cancel stop while presence keeps reporting.
    vi.advanceTimersByTime(ATTENTION_IDLE_MS + 1_000);
    expect(isSessionActive({ idleAfterMs: ATTENTION_IDLE_MS })).toBe(false);
    expect(isSessionActive({ idleAfterMs: PRESENCE_IDLE_MS })).toBe(true);

    vi.advanceTimersByTime(PRESENCE_IDLE_MS);
    expect(isSessionActive({ idleAfterMs: PRESENCE_IDLE_MS })).toBe(false);
  });

  it('input resets the idle clock', async () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);
    const { isSessionActive, ATTENTION_IDLE_MS } = await load();

    // Read once first: the source starts lazily and seeds the input clock when it
    // does, so a fresh load counts as active for one idle window without input.
    expect(isSessionActive({ idleAfterMs: ATTENTION_IDLE_MS })).toBe(true);
    vi.advanceTimersByTime(ATTENTION_IDLE_MS + 1_000);
    expect(isSessionActive({ idleAfterMs: ATTENTION_IDLE_MS })).toBe(false);

    document.dispatchEvent(new Event('keydown'));
    expect(isSessionActive({ idleAfterMs: ATTENTION_IDLE_MS })).toBe(true);
  });

  it('blur is a hard inactive edge, not a timer', async () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);
    const { isSessionActive, ATTENTION_IDLE_MS } = await load();
    expect(isSessionActive({ idleAfterMs: ATTENTION_IDLE_MS })).toBe(true);

    window.dispatchEvent(new Event('blur'));
    expect(isSessionActive({ idleAfterMs: ATTENTION_IDLE_MS })).toBe(false);

    window.dispatchEvent(new Event('focus'));
    expect(isSessionActive({ idleAfterMs: ATTENTION_IDLE_MS })).toBe(true);
  });

  it('notifies subscribers on hard edges', async () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);
    const { subscribeSessionActivity } = await load();
    const listener = vi.fn();
    const unsubscribe = subscribeSessionActivity(listener);

    window.dispatchEvent(new Event('blur'));
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    window.dispatchEvent(new Event('focus'));
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
