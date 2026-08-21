'use client';

import { appPlugin } from './native-shell';
import { isMobileShell } from './platform';

/**
 * "Is a human at this session right now" — the signal behind cancelling a phone
 * push and behind the presence heartbeat.
 *
 * Deliberately NOT the same question as "was this notification seen". Session
 * activity is a property of the tab; whether an item was read is a property of the
 * item, and inferring one from the other is what let an unattended browser clear
 * notifications off the user's phone (read state is cross-device: a read event
 * drives `PushRetractionListener` → retraction push).
 *
 * ## Two thresholds, because the error costs are asymmetric
 *
 * Reporting active while the user is away cancels a push **permanently** — the
 * server grace is 7s and nothing re-arms it. Reporting inactive while the user is
 * present merely skips that grace. So the cancel decision uses a short idle
 * window and presence a long one; callers pass the one they need.
 *
 * ## Two implementations, not one plus an event
 *
 * The web reads focus plus input recency. The mobile shell reads
 * `appStateChange` and nothing else:
 *
 *   - `pointermove` does not exist on touch, so an input-recency timer would call
 *     a user who is reading — and touching nothing — idle. That is strictly worse
 *     than the `visibilityState` gate it replaces.
 *   - `appStateChange` is the shell's authoritative foreground signal; the
 *     WebView's own `visibilityState` is documented as unreliable for this
 *     (see `AppPlugin` in native-shell.ts, and `token-freshness-watcher.tsx`).
 *
 * Measured on iPhone 17 Pro / iOS 26.5 (simulator, 2026-08-21): `hasFocus()` reads
 * `true` in WKWebView with no focused input, so including it would not have broken
 * the shell — the touch argument above is the reason for the split, not that one.
 *
 * ## Shape
 *
 * A plain subscribable store started lazily, mirroring `connectivity.ts`. Lazy
 * matters: the app builds `output: export`, so a module-scope `addEventListener`
 * would run in Node during prerender.
 */

/** Cancelling a push is unrecoverable, so treat a short silence as "gone". */
export const CANCEL_IDLE_MS = 90_000;
/** Presence only costs a skipped grace window; be generous. */
export const PRESENCE_IDLE_MS = 5 * 60_000;

/** `pointermove` fires continuously; one timestamp write per this window is plenty. */
const MOVE_THROTTLE_MS = 1_000;

type Listener = () => void;

const listeners = new Set<Listener>();
let sourceStarted = false;

/** Web: last input timestamp. Mobile: unused — `shellActive` is the whole answer. */
let lastInputAt = 0;
let lastMoveWrite = 0;
/**
 * Hard inactive edge (blur / hidden / pagehide). Distinct from the idle timer:
 * a blurred window is inactive immediately, not after the threshold.
 */
let windowActive = true;
/** Mobile only. Seeded true: `AppPlugin` exposes no synchronous state read. */
let shellActive = true;

function notify(): void {
  for (const listener of [...listeners]) listener();
}

function setWindowActive(next: boolean): void {
  if (windowActive === next) return;
  windowActive = next;
  if (next) lastInputAt = Date.now();
  notify();
}

function recordInput(): void {
  lastInputAt = Date.now();
}

function recordMove(): void {
  const now = Date.now();
  if (now - lastMoveWrite < MOVE_THROTTLE_MS) return;
  lastMoveWrite = now;
  lastInputAt = now;
}

function startSource(): void {
  if (sourceStarted || typeof window === 'undefined') return;
  sourceStarted = true;
  lastInputAt = Date.now();

  if (isMobileShell()) {
    const app = appPlugin();
    if (!app) return;
    try {
      // The injected bridge proxy returns a bare handle, not the Promise its type
      // advertises (see native-back.ts) — never chain on it directly.
      void Promise.resolve(
        app.addListener('appStateChange', ({ isActive }) => {
          if (shellActive === isActive) return;
          shellActive = isActive;
          notify();
        }),
      ).catch(error => console.error('[session-activity] appStateChange registration failed:', error));
    } catch (error) {
      console.error('[session-activity] appStateChange registration threw:', error);
    }
    return;
  }

  // Capture phase on `document`, not `window`: the app scrolls an inner
  // `main.overflow-y-auto` and `scroll` does not bubble.
  const options = { capture: true, passive: true } as const;
  document.addEventListener('pointerdown', recordInput, options);
  document.addEventListener('keydown', recordInput, options);
  document.addEventListener('scroll', recordInput, options);
  document.addEventListener('pointermove', recordMove, options);

  window.addEventListener('focus', () => setWindowActive(true));
  window.addEventListener('blur', () => setWindowActive(false));
  window.addEventListener('pagehide', () => setWindowActive(false));
  document.addEventListener('visibilitychange', () => {
    setWindowActive(document.visibilityState === 'visible' && document.hasFocus());
  });

  windowActive = document.hasFocus();
}

/**
 * @param idleAfterMs how long without input still counts as active. Use
 *   {@link CANCEL_IDLE_MS} for anything irreversible, {@link PRESENCE_IDLE_MS}
 *   for reporting presence.
 */
export function isSessionActive({ idleAfterMs }: { idleAfterMs: number }): boolean {
  if (typeof window === 'undefined') return false;
  startSource();
  if (isMobileShell()) return shellActive;
  if (!windowActive) return false;
  return Date.now() - lastInputAt < idleAfterMs;
}

/**
 * Fires on hard edges only (focus/blur, foreground/background) — NOT when the idle
 * timer lapses, which is a clock question with no event behind it. Poll
 * `isSessionActive` for that.
 */
export function subscribeSessionActivity(listener: Listener): () => void {
  startSource();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
