'use client';

import { useSyncExternalStore } from 'react';
import { isDesktopShell } from '@/lib/platform';

/** A document cannot change shell mid-session, so there is nothing to subscribe to. */
function subscribe(): () => void {
  return () => {};
}

/** Server snapshot: assume the browser, then correct on hydration. */
function getServerSnapshot(): boolean {
  return false;
}

/**
 * `isDesktopShell()` made safe to branch on during render — the desktop sibling of
 * {@link useIsMobileShell}, and the same trade for the same reason: prerendered HTML
 * is produced with no `window`, so the build always answers "web" while Tauri answers
 * "desktop", and a bare predicate in a component body regenerates the subtree.
 *
 * Reach for it when the answer reaches the DOM — including as an attribute value such as
 * a link's `target`, which hydration compares like any other. A predicate consumed inside
 * an effect, or one that only gates a request, can call `isDesktopShell()` directly.
 */
export function useIsDesktopShell(): boolean {
  return useSyncExternalStore(subscribe, isDesktopShell, getServerSnapshot);
}
