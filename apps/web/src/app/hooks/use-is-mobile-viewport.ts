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

/** A server has no viewport, and hydration replays this — so: not known yet. */
function getServerSnapshot(): undefined {
  return undefined;
}

/**
 * Viewport narrower than the ODS `md` breakpoint (800px), live, or `undefined`
 * while the client viewport is still unknown.
 *
 * The viewport axis, NOT `useIsMobileShell()` — that one answers "is this the
 * phone app", which says nothing about a narrow browser window on the desktop.
 *
 * There is no honest boolean to prerender with. Answering `false` on the server
 * ships HTML that says "desktop", and hydration REPLAYS the server snapshot
 * before the first client snapshot lands, so a phone renders the desktop answer
 * twice and any component that picks between two SUBTREES on it mounts the
 * wrong one and pays for whatever that subtree fetches. `undefined` makes those
 * renders say "don't know" instead, so callers can hold on something neutral;
 * the real answer arrives immediately after.
 *
 * Use core's `useMdUp()` for anything that only styles or arranges what it was
 * going to render anyway; use this when the answer decides which component
 * exists.
 */
export function useIsMobileViewport(): boolean | undefined {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
