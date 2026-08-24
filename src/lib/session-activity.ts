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
 * Two questions, two windows, and callers pass the one they need:
 *
 *   - **Attention** — "is the user at the keyboard *right now*", i.e. will an
 *     in-app artefact (the 4s live tile, a drawer entry) actually be seen? Gates
 *     auto-read and the push cancel. Both are irreversible in the same way: a
 *     cancelled push is never re-armed (server grace is 7s), and marking read is
 *     cross-device — it retracts the banner off the phone. So the window is
 *     deliberately TIGHT. Under-firing costs a redundant buzz; over-firing loses
 *     the notification.
 *   - **Presence** — "is the user around at all", feeding the server heartbeat and
 *     the outbox grace decision. Costs a skipped 7s grace when wrong, so it is
 *     generous.
 *
 * The tight window means ordinary *reading* — which produces no input — reads as
 * inattentive after ATTENTION_IDLE_MS. That is the safe direction for both
 * consumers (item stays unread, push still arrives), but it does mean the phone
 * can buzz for something on screen. If that proves worse than the loss risk, raise
 * the cancel call site alone; the threshold is per-call for exactly that reason.
 *
 * ## Two implementations, not one plus an event
 *
 * The web reads focus plus input recency. The mobile shell reads
 * `appStateChange` and nothing else:
 *
 *   - `pointermove` does not exist on touch, so an input-recency timer would call
 *     a user who is reading — and touching nothing — idle. At ATTENTION_IDLE_MS
 *     that would be *every* reading user, every time; strictly worse than the
 *     `visibilityState` gate it replaces.
 *   - The consequence is a DELIBERATE divergence: on the shell, foreground alone
 *     means attentive, with no idle window at all. Holding a phone and looking at
 *     it is stronger evidence than a focused desktop window, so the more
 *     permissive answer is the better one here — but it is a choice, not an
 *     oversight.
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

/**
 * Auto-read and push-cancel. Both are irreversible, so a short silence counts as
 * "not watching" — roughly the life of the live tile plus a beat.
 */
export const ATTENTION_IDLE_MS = 10_000;
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
 *   {@link ATTENTION_IDLE_MS} for anything irreversible (auto-read, push cancel),
 *   {@link PRESENCE_IDLE_MS} for reporting presence.
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
