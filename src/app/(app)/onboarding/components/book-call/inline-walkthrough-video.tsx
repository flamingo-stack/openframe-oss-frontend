'use client';

/**
 * The walkthrough demo video as an IN-PAGE block — the right half of the
 * onboarding "Book a call" promo. Same lib component and same data as the
 * app-shell floating card, only laid out by this page's flow
 * (`placement="inline"`).
 *
 * Mounting this CLAIMS the video for the page: the floating card steps aside
 * for as long as this is on screen, so the clip is never offered twice at once
 * (see {@link useInlineWalkthroughClaim}).
 *
 * NOT DISMISSIBLE (`dismissal={false}`), for two reasons. An X is an overlay
 * affordance — "get out of my way" — and this block is in the page's own flow
 * inside a promo card that owns the slot; closing it just leaves the card
 * lopsided. And the dismissal cookie is per-platform, NOT per-mount: sharing it
 * with the floating card meant one dismissal in the corner silently emptied
 * this half of the promo, with nothing on screen to explain why or undo it.
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

import { FloatingWalkthroughVideo } from '@flamingo-stack/openframe-frontend-core/components/features';
import { Skeleton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { usePathname } from 'next/navigation';
import { useWalkthroughVideoData } from '@/app/hooks/use-walkthrough-video-data';
import { useInlineWalkthroughClaim } from '@/lib/inline-walkthrough-signal';

export function InlineWalkthroughVideo({ className }: { className?: string }) {
  const pathname = usePathname();
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

  return (
    <FloatingWalkthroughVideo
      video={video}
      placement="inline"
      // The lib can't observe navigation; feeding it the route keeps its
      // pathname-derived work in step after a soft nav.
      pathname={pathname ?? undefined}
      dismissal={false}
      className={className}
    />
  );
}
