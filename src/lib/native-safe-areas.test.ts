/**
 * Pins the safe-area publishing rules that keep the app chrome correct across a
 * video fullscreen round-trip.
 *
 * Capacitor turns on WKWebView element fullscreen, so the Mux player's fullscreen
 * button reparents the WKWebView — which IS the bridge view controller's root
 * view — into WebKit's own fullscreen window, whose view controller hides the
 * status bar. `getSafeAreaInsets` reads ~0 there; entering fires a `resize` that
 * published those zeros, and exiting restores the same viewport size and fires no
 * second resize, so they stuck and the header came back under the Dynamic Island.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const REAL = { top: 62, bottom: 34, left: 0, right: 0 };
/** What the native call reports while WebKit owns the webview — status bar hidden. */
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

/** jsdom implements neither half of the Fullscreen API. */
function setFullscreenElement(el: Element | null, key: 'fullscreenElement' | 'webkitFullscreenElement') {
  Object.defineProperty(document, key, { value: el, configurable: true, writable: true });
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

    await vi.waitFor(() => expect(topVar()).toBe('62px'));
  });
});
