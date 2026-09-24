'use client';

/**
 * "An inline walkthrough video is on screen" — keeps the app-shell floating
 * card from playing the same clip the page already renders inside itself.
 *
 * A COUNTER, not a boolean: a route transition mounts the incoming tree before
 * unmounting the outgoing one, so a boolean would be cleared by the first of
 * two overlapping unmounts and the corner card would flash back.
 *
 * Claimed by the component that renders the inline video rather than by route,
 * because the Initial Setup card disappears once setup is complete — suppress
 * by `pathname` and the floating card would stay hidden on /dashboard forever.
 */

import { useEffect } from 'react';
import { create } from 'zustand';

interface InlineWalkthroughSignalState {
  claims: number;
  claim: () => void;
  release: () => void;
}

const useInlineWalkthroughSignal = create<InlineWalkthroughSignalState>(set => ({
  claims: 0,
  claim: () => set(state => ({ claims: state.claims + 1 })),
  // `Math.max` guards StrictMode's double-invoked cleanup in dev.
  release: () => set(state => ({ claims: Math.max(0, state.claims - 1) })),
}));

/**
 * Register this component as rendering the walkthrough video inline. Pass
 * `active` false when the block has no video to show — suppressing the
 * floating card then would trade one visible video for none.
 */
export function useInlineWalkthroughClaim(active: boolean): void {
  useEffect(() => {
    if (!active) return undefined;
    const { claim, release } = useInlineWalkthroughSignal.getState();
    claim();
    return release;
  }, [active]);
}

/** True while any inline walkthrough video is mounted. */
export function useHasInlineWalkthrough(): boolean {
  return useInlineWalkthroughSignal(state => state.claims > 0);
}
