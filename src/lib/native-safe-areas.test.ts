/**
 * Pins the safe-area publishing rules that keep the app chrome correct across a
 * video fullscreen round-trip.
 *
 * Capacitor turns on element fullscreen, so the Mux player's fullscreen button
 * takes it, and both shells hide their system bars to service it. A shell that
 * measures the view the platform took over reads ~0 while fullscreen — iOS did,
 * measured, until it moved to measuring the window — and a zero published then is
 * what sticks, because the exit is not guaranteed to resize anything: the header
 * comes back under the notch. Hence the guard and the exit republish below, which
 * keep the app correct whatever a given shell's read reports mid-fullscreen.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const REAL = { top: 62, bottom: 34, left: 0, right: 0 };
/** What a shell that measures the taken-over view reports while fullscreen. */
const FULLSCREEN = { top: 0, bottom: 0, left: 0, right: 0 };

let getSafeAreaInsets: ReturnType<typeof vi.fn>;

/** Fresh module registry per test — `platform.ts` memoizes the shell kind. */
async function loadShell() {
  vi.resetModules();
  getSafeAreaInsets = vi.fn(async () => REAL);
  (window as unknown as Record<string, unknown>).Capacitor = {
    isNativePlatform: () => true,
    getPlatform: () => 'ios',
    Plugins: { NativeAuth: { getSafeAreaInsets }, StatusBar: {} },
  };
  return import('./native-shell');
}

function topVar() {
  return document.documentElement.style.getPropertyValue('--native-safe-top');
}

function bottomVar() {
  return document.documentElement.style.getPropertyValue('--native-safe-bottom');
}

type KeyboardListener = (payload: { keyboardHeight: number }) => void;

/**
 * The Android shell, whose keyboard takes the navigation band out of the
 * WebView. Both modules come from one registry so the keyboard listener reaches
 * the same `native-shell` state `applyNativeSafeAreas` publishes from.
 */
async function loadAndroidShell() {
  vi.resetModules();
  getSafeAreaInsets = vi.fn(async () => REAL);
  const listeners: Record<string, KeyboardListener> = {};
  (window as unknown as Record<string, unknown>).Capacitor = {
    isNativePlatform: () => true,
    getPlatform: () => 'android',
    Plugins: {
      NativeAuth: { getSafeAreaInsets },
      StatusBar: {},
      Keyboard: {
        addListener: (event: string, listenerFunc: KeyboardListener) => {
          listeners[event] = listenerFunc;
          return { remove: () => {} };
        },
      },
    },
  };
  const shell = await import('./native-shell');
  const { initKeyboardInset } = await import('./keyboard-inset');
  return { ...shell, initKeyboardInset, listeners };
}

/** jsdom implements neither half of the Fullscreen API. */
function setFullscreenElement(el: Element | null, key: 'fullscreenElement' | 'webkitFullscreenElement') {
  Object.defineProperty(document, key, { value: el, configurable: true, writable: true });
}

/**
 * Wait for a publish to land.
 *
 * `applyNativeSafeAreas` is fired and forgotten (`void applyNativeSafeAreas()`), so a
 * test cannot await it — but with `getSafeAreaInsets` mocked to resolve immediately the
 * whole chain is MICROTASKS. One macrotask hop therefore guarantees it has run, with no
 * dependence on wall-clock time.
 *
 * This replaced `vi.waitFor`, whose 1s default made the file flaky: under parallel
 * workers a starved thread could miss that window entirely and time out before the
 * suppression landed (measured ~4 failures in 10 full-suite runs, 0 in 6 runs of the
 * file alone and 0 with --no-file-parallelism). Polling on real timers is the wrong
 * tool for a deterministic microtask chain.
 */
function flushPublish(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

beforeEach(() => {
  document.documentElement.removeAttribute('style');
  setFullscreenElement(null, 'fullscreenElement');
  setFullscreenElement(null, 'webkitFullscreenElement');
});

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).Capacitor;
});

describe('applyNativeSafeAreas', () => {
  it('publishes the native insets normally', async () => {
    const { applyNativeSafeAreas } = await loadShell();
    await applyNativeSafeAreas();
    expect(topVar()).toBe('62px');
  });

  it('publishes nothing while an element is fullscreen, so zeros never land', async () => {
    const { applyNativeSafeAreas } = await loadShell();
    await applyNativeSafeAreas();

    getSafeAreaInsets.mockResolvedValue(FULLSCREEN);
    setFullscreenElement(document.body, 'fullscreenElement');
    await applyNativeSafeAreas();

    expect(topVar()).toBe('62px');
    // The early return must beat the bridge call — the value is not just discarded.
    expect(getSafeAreaInsets).toHaveBeenCalledTimes(1);
  });

  it('honours the webkit-prefixed element too (iOS 15.4–16.3)', async () => {
    const { applyNativeSafeAreas } = await loadShell();
    await applyNativeSafeAreas();

    getSafeAreaInsets.mockResolvedValue(FULLSCREEN);
    setFullscreenElement(document.body, 'webkitFullscreenElement');
    await applyNativeSafeAreas();

    expect(topVar()).toBe('62px');
  });
});

describe('initNativeChrome', () => {
  it('republishes on fullscreen exit, which fires no resize of its own', async () => {
    const { initNativeChrome } = await loadShell();
    await initNativeChrome();
    expect(topVar()).toBe('62px');

    // Enter: the resize WebKit does fire is skipped by the fullscreen guard. Wait
    // past the 350ms trailing read so no in-flight timer can republish later and
    // make the exit assertion below pass for the wrong reason.
    setFullscreenElement(document.body, 'fullscreenElement');
    getSafeAreaInsets.mockResolvedValue(FULLSCREEN);
    window.dispatchEvent(new Event('resize'));
    await new Promise(resolve => setTimeout(resolve, 450));
    expect(topVar()).toBe('62px');

    // Exit: no resize accompanies it, so `fullscreenchange` is the only signal
    // that can undo a stale value.
    document.documentElement.style.setProperty('--native-safe-top', '0px');
    setFullscreenElement(null, 'fullscreenElement');
    getSafeAreaInsets.mockResolvedValue(REAL);
    document.dispatchEvent(new Event('fullscreenchange'));

    await flushPublish();
    expect(topVar()).toBe('62px');
  });
});

/**
 * The keyboard's claim on the bottom band. Android's shell resizes the WebView
 * around the keyboard, so the navigation band it publishes as
 * `--native-safe-bottom` is no longer inside the viewport at all.
 */
describe('bottom inset while the Android keyboard is up', () => {
  it('drops the navigation band on show and restores it on hide', async () => {
    const { initNativeChrome, initKeyboardInset, listeners } = await loadAndroidShell();
    await initNativeChrome();
    initKeyboardInset();
    expect(bottomVar()).toBe('34px');

    listeners.keyboardWillShow({ keyboardHeight: 300 });
    await flushPublish();
    expect(bottomVar()).toBe('0px');
    // Only the bottom edge moves — the status bar is still above the WebView.
    expect(topVar()).toBe('62px');

    listeners.keyboardWillHide({ keyboardHeight: 0 });
    await flushPublish();
    expect(bottomVar()).toBe('34px');
  });

  it('survives the resize the keyboard itself fires', async () => {
    const { initNativeChrome, initKeyboardInset, listeners } = await loadAndroidShell();
    await initNativeChrome();
    initKeyboardInset();

    listeners.keyboardWillShow({ keyboardHeight: 300 });
    await flushPublish();
    expect(bottomVar()).toBe('0px');

    // The WebView resizing IS the keyboard opening on Android, and
    // initNativeChrome republishes every inset on resize — immediately and again
    // at 350ms. Both must publish the suppressed value, or the band comes back
    // under the bar a third of a second after it left.
    window.dispatchEvent(new Event('resize'));
    await new Promise(resolve => setTimeout(resolve, 450));
    expect(bottomVar()).toBe('0px');
  });

  it('keeps the band for a floating IME, which resizes nothing', async () => {
    const { initNativeChrome, initKeyboardInset, listeners } = await loadAndroidShell();
    await initNativeChrome();
    initKeyboardInset();

    listeners.keyboardWillShow({ keyboardHeight: 0 });
    await flushPublish();
    expect(bottomVar()).toBe('34px');
  });

  it('publishes no keyboard inset — the layout viewport already lost it', async () => {
    const { initNativeChrome, initKeyboardInset, listeners } = await loadAndroidShell();
    await initNativeChrome();
    initKeyboardInset();

    listeners.keyboardWillShow({ keyboardHeight: 300 });
    await flushPublish();
    expect(bottomVar()).toBe('0px');

    expect(document.documentElement.style.getPropertyValue('--of-keyboard-inset')).toBe('');
  });
});
