'use client';

import { useSyncExternalStore } from 'react';
import { isMobileShell } from '@/lib/platform';

/** A document cannot change shell mid-session, so there is nothing to subscribe to. */
function subscribe(): () => void {
  return () => {};
}

/** Server snapshot: assume the browser, then correct on hydration. */
function getServerSnapshot(): boolean {
  return false;
}

/**
 * `isMobileShell()` made safe to branch on during render.
 *
 * Calling the predicate straight from a component body is a hydration mismatch:
 * prerendered HTML — including the static export the shells bundle — is produced
 * with no `window`, so the build always answers "web" while the phone answers
 * "mobile", and React regenerates the subtree. This hands hydration the server's
 * answer and re-renders with the real one, the same trade
 * `usePrefersReducedMotion` makes.
 *
 * The cost is one frame of the web variant on the phone. For anything that must
 * be right in the FIRST painted frame, key off CSS the shell can set before
 * hydration instead.
 */
export function useIsMobileShell(): boolean {
  return useSyncExternalStore(subscribe, isMobileShell, getServerSnapshot);
}
