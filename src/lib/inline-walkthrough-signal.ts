'use client';

/**
 * "An inline walkthrough video is on screen" — the one signal that keeps the
 * app-shell FLOATING card (`<WalkthroughVideo>`, mounted once in the app
 * layout) from sitting in the corner playing the same clip the page already
 * renders inside itself (the onboarding "Book a call" promo). Both surfaces
 * that mount the promo — the dashboard Initial Setup card and /onboarding —
 * are pages the floating card is also live on, so without this the user sees
 * the video twice.
 *
 * A COUNTER, not a boolean: during a route transition React mounts the
 * incoming tree before unmounting the outgoing one, so with a boolean the
 * first of two overlapping unmounts would clear the flag and the corner card
 * would flash back for a frame.
 *
 * Route-based suppression was the alternative and is wrong: the Initial Setup
 * card is a one-time surface that disappears from the dashboard once setup is
 * complete, so `pathname === '/dashboard'` would keep the floating card hidden
 * there forever. Claiming from the component that actually renders the inline
 * video is precise by construction — see {@link useInlineWalkthroughClaim}.
 */

import { useEffect } from 'react';
import { create } from 'zustand';

interface InlineWalkthroughSignalState {
  /** How many inline walkthrough videos are currently mounted. */
  claims: number;
  claim: () => void;
  release: () => void;
}

const useInlineWalkthroughSignal = create<InlineWalkthroughSignalState>(set => ({
  claims: 0,
  claim: () => set(state => ({ claims: state.claims + 1 })),
  // `Math.max` guards the double-invoked cleanup React StrictMode runs in dev;
  // a negative count would silently re-show the floating card.
  release: () => set(state => ({ claims: Math.max(0, state.claims - 1) })),
}));

/**
 * Register this component as rendering the walkthrough video inline.
 *
 * `active` matters: claim only while the inline block ACTUALLY shows a video.
 * A page that mounts the block but has no video to put in it must not suppress
 * the floating card — that would trade one visible video for none.
 */
export function useInlineWalkthroughClaim(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const { claim, release } = useInlineWalkthroughSignal.getState();
    claim();
    return release;
  }, [active]);
}

/** True while any inline walkthrough video is mounted. */
export function useHasInlineWalkthrough(): boolean {
  return useInlineWalkthroughSignal(state => state.claims > 0);
}
