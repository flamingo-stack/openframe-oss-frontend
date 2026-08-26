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
    // The config sets no `restoreMocks`, so the `hasFocus` spies installed per test
    // would otherwise leak into the ones that don't install their own.
    vi.restoreAllMocks();
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

  // Programmatic scrolling fires TRUSTED scroll events, and core-lib's chat pins itself
  // to the bottom on every incoming message. Counting that as input kept an unattended
  // tab "attentive" forever, on the surface this gate exists to protect. Pinned so a
  // future re-add of `scroll` to the input set cannot pass silently.
  it('does not treat scroll as user input', async () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);
    const { isSessionActive, ATTENTION_IDLE_MS } = await load();

    expect(isSessionActive({ idleAfterMs: ATTENTION_IDLE_MS })).toBe(true);
    vi.advanceTimersByTime(ATTENTION_IDLE_MS + 1_000);

    document.dispatchEvent(new Event('scroll'));
    expect(isSessionActive({ idleAfterMs: ATTENTION_IDLE_MS })).toBe(false);

    // ...while a real gesture still counts.
    document.dispatchEvent(new Event('wheel'));
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

  // This path has been wrong twice: once by latching `sourceStarted` before the plugin
  // lookup, once by latching `usingShellSource` before an ASYNC registration rejection.
  // Both made isSessionActive answer true forever — failing open on auto-read and push
  // cancel, the two irreversible actions. Pinned rather than re-argued.
  describe('shell registration failure falls back to the web source', () => {
    async function loadMobile(addListener: () => unknown) {
      vi.doMock('./platform', () => ({ isMobileShell: () => true }));
      vi.doMock('./native-shell', () => ({ appPlugin: () => ({ addListener }) }));
      return import('./session-activity');
    }

    it('falls back when the plugin is absent', async () => {
      vi.spyOn(document, 'hasFocus').mockReturnValue(false);
      vi.doMock('./platform', () => ({ isMobileShell: () => true }));
      vi.doMock('./native-shell', () => ({ appPlugin: () => null }));
      const { isSessionActive, ATTENTION_IDLE_MS } = await import('./session-activity');
      // Unfocused window ⇒ the web source says inactive. A latched shell source would
      // report `true` here off the seeded value.
      expect(isSessionActive({ idleAfterMs: ATTENTION_IDLE_MS })).toBe(false);
    });

    it('falls back when registration throws synchronously', async () => {
      vi.spyOn(document, 'hasFocus').mockReturnValue(false);
      const { isSessionActive, ATTENTION_IDLE_MS } = await loadMobile(() => {
        throw new Error('bridge exploded');
      });
      expect(isSessionActive({ idleAfterMs: ATTENTION_IDLE_MS })).toBe(false);
    });

    it('falls back when registration rejects asynchronously', async () => {
      vi.spyOn(document, 'hasFocus').mockReturnValue(false);
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const { isSessionActive, ATTENTION_IDLE_MS } = await loadMobile(() => Promise.reject(new Error('nope')));

      // Before the microtask flush the shell source is still believed good.
      expect(isSessionActive({ idleAfterMs: ATTENTION_IDLE_MS })).toBe(true);
      await vi.waitFor(() => expect(isSessionActive({ idleAfterMs: ATTENTION_IDLE_MS })).toBe(false));
    });
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
