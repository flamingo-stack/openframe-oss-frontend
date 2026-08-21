'use client';

/**
 * The walkthrough demo video as the right half of the onboarding "Book a call"
 * promo: the lib's `<InlineWalkthroughVideo>` — the same widget and the same
 * data as the app-shell floating card, laid out by this page's flow — plus the
 * two things that are this page's job rather than the widget's: claiming the
 * clip from the floating card, and holding the slot while the data loads.
 *
 * Mounting this CLAIMS the video for the page: the floating card steps aside
 * for as long as this is on screen, so the clip is never offered twice at once
 * (see {@link useInlineWalkthroughClaim}).
 *
 * Holds its box WHILE LOADING with a placeholder of the same 16:9 shape. The
 * video is a second network round-trip after the page is already painted, so
 * without it the promo sat visibly half-empty and the video popped in — the
 * card's height is fixed, so nothing moved, but the pop was the whole problem.
 *
 * Renders nothing once the request settles with no video configured, which
 * simply lets the promo's copy take the full width. Distinguishing those two
 * `null`s is what `isLoading` is for.
 */

import { InlineWalkthroughVideo } from '@flamingo-stack/openframe-frontend-core/components/features';
import { Skeleton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { useWalkthroughVideoData } from '@/app/hooks/use-walkthrough-video-data';
import { useInlineWalkthroughClaim } from '@/lib/inline-walkthrough-signal';

export function BookCallWalkthroughVideo({ className }: { className?: string }) {
  const { video, isLoading } = useWalkthroughVideoData();
  // Mirrors the lib's own render guard, so the claim tracks what is actually on
  // screen: no playable source means this block renders nothing, and suppressing
  // the floating card then would leave the user with no video at all.
  useInlineWalkthroughClaim(Boolean(video?.mainVideoUrl || video?.youtubeUrl));

  if (isLoading) {
    // The placeholder and the video that replaces it are the same box to the
    // pixel: `aspect-video w-full` is the lib card's own base geometry, and the
    // host's `className` — which is what actually sizes this block inside the
    // promo (a height-derived width on tablet, a stated column on desktop) —
    // lands on both. Anything that sized only one of the two would show up as
    // a jump at the moment the video arrives, which is the whole reason this
    // placeholder exists: the video is a second round-trip after the page has
    // painted, so without it the promo sat visibly half-empty.
    return <Skeleton className={cn('aspect-video w-full rounded-md', className)} />;
  }

  return <InlineWalkthroughVideo video={video} className={className} />;
}
