'use client';

import { useState } from 'react';

/**
 * Where a collapsible body is. `opening` is mounted but still collapsed — one
 * paint later it turns `open`, which is what lets the grid-rows transition run
 * on a freshly mounted body. `closing` stays mounted until the collapse ends.
 * Null = not mounted, so a closed body costs nothing.
 */
export type CollapsePhase = 'opening' | 'open' | 'closing';

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** The phase a toggle moves to. */
export function toggledPhase(phase: CollapsePhase | null): CollapsePhase | null {
  // Still collapsed: nothing to animate, so no transition end would ever report —
  // `closing` would leave the body mounted.
  if (phase === 'opening') return null;
  // No transition runs under reduced motion, so nothing would report the end.
  if (phase === 'open') return prefersReducedMotion() ? null : 'closing';
  return 'opening';
}

/**
 * Two frames: the first commits the collapsed body, the second is painted with
 * it, so switching to `open` animates instead of snapping.
 */
export function afterPaint(callback: () => void): void {
  requestAnimationFrame(() => requestAnimationFrame(callback));
}

interface CollapsePhaseState {
  phase: CollapsePhase | null;
  /** Opens a closed body, or starts closing an open one. */
  toggle: () => void;
  /** The collapse transition ended — unmount the body. */
  collapsed: () => void;
}

/** One element's collapsible body, on the app's grid-rows idiom (see `onboarding-accordion.tsx`). */
export function useCollapsePhase(): CollapsePhaseState {
  const [phase, setPhase] = useState<CollapsePhase | null>(null);

  const toggle = () => {
    setPhase(toggledPhase);
    afterPaint(() => setPhase(prev => (prev === 'opening' ? 'open' : prev)));
  };

  const collapsed = () => {
    setPhase(prev => (prev === 'closing' ? null : prev));
  };

  return { phase, toggle, collapsed };
}
