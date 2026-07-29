'use client';

import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const media = window.matchMedia(QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

function getSnapshot(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(QUERY).matches;
}

/** Server snapshot: assume motion is fine, then correct on hydration. */
function getServerSnapshot(): boolean {
  return false;
}

/**
 * `prefers-reduced-motion: reduce`, live. `useSyncExternalStore` so the value is
 * SSR-safe and stays in sync when the OS setting changes mid-session.
 *
 * Use it for motion that CSS can't opt out of — animations driven from JS or
 * inline styles (e.g. dnd-kit's sortable transition). Plain CSS transitions
 * should use Tailwind's `motion-reduce:` variant instead.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
