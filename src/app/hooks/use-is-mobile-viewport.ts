'use client';

import { breakpoints } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const media = window.matchMedia(breakpoints.md);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

function getSnapshot(): boolean {
  return typeof window !== 'undefined' && !window.matchMedia(breakpoints.md).matches;
}

/** Server snapshot: assume tablet-and-up, then correct on hydration. */
function getServerSnapshot(): boolean {
  return false;
}

/**
 * Viewport narrower than the ODS `md` breakpoint (800px), live.
 *
 * The viewport axis, NOT `useIsMobileShell()` — that one answers "is this the
 * phone app", which says nothing about a narrow browser window on the desktop.
 *
 * Core's `useMdUp()` measures the same query but answers `undefined` until a
 * layout effect has run, so a component that picks between two SUBTREES on it
 * mounts the wrong one first and pays for whatever that subtree fetches. This
 * reads `matchMedia` during render instead, so the first render is already
 * right on the client. Use `useMdUp()` for anything that only styles or
 * arranges what it was going to render anyway; use this when the answer decides
 * which component exists.
 */
export function useIsMobileViewport(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
