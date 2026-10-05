'use client';

import { useSyncExternalStore } from 'react';
import { isAppShell } from '@/lib/platform';
import { useIsMobileViewport } from './use-is-mobile-viewport';

/** A document cannot change shell mid-session, so there is nothing to subscribe to. */
function subscribe(): () => void {
  return () => {};
}

/** Server snapshot: assume the web, then correct on hydration. */
function getServerSnapshot(): boolean {
  return false;
}

/**
 * Whether a link that would normally open a new tab has to stay in this window.
 *
 * Two independent reasons, both true on a phone:
 *
 *   - **The app shell has no tabs.** `target="_blank"` and `window.open()` are
 *     silently dropped by the Capacitor WKWebView, so a chip that opens a new
 *     tab is simply a dead click there — the failure this hook was written for.
 *     Shell, not viewport, because a tablet running the mobile app is a wide
 *     viewport with the same dead click. In that shell an off-origin
 *     `location.assign` is handed to the system browser (see `performLogout`),
 *     so external links still leave the app the way they should.
 *   - **A narrow window has tabs but shouldn't use one here.** Backgrounding
 *     the conversation into a tab the user has to hunt for is worse than
 *     navigating and coming back.
 *
 * That second term is WIDTH, not device, so a desktop window dragged under md
 * is treated as a phone on purpose. Above md a new tab is the polite option
 * because the chat drawer sits BESIDE the page; below it the core drawer goes
 * `inset-0` at this very breakpoint (`mobileBreakpoint = 800`) and covers the
 * page it would otherwise sit next to, which is the layout the argument for a
 * new tab rests on. Wide viewports keep opening new tabs, as before.
 */
export function useSameWindowLinks(): boolean {
  const isMobileViewport = useIsMobileViewport();
  const appShell = useSyncExternalStore(subscribe, isAppShell, getServerSnapshot);
  // A link target has no "still loading" state, so an unknown viewport keeps the
  // wide-screen answer — the same thing this returned before it could be unknown.
  return appShell || isMobileViewport === true;
}
