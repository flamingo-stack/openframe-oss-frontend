'use client';

/**
 * The walkthrough video as the right half of the "Book a call" promo: the lib's
 * `<InlineWalkthroughVideo>` plus the two things that are this page's job —
 * claiming the clip from the app-shell floating card so it isn't offered twice
 * at once, and holding the 16:9 slot while the data loads.
 *
 * Renders nothing once the request settles with no video configured, letting
 * the copy span the card. Telling that apart from "not loaded yet" is what
 * `isLoading` is for.
 */

import { InlineWalkthroughVideo } from '@flamingo-stack/openframe-frontend-core/components/features';
import { Skeleton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { useWalkthroughVideoData } from '@/app/hooks/use-walkthrough-video-data';
import { useInlineWalkthroughClaim } from '@/lib/inline-walkthrough-signal';

export function BookCallWalkthroughVideo({ className }: { className?: string }) {
  const { video, isLoading } = useWalkthroughVideoData();
  // Mirrors the lib's own render guard so the claim tracks what is actually on
  // screen — claiming with no playable source would leave the user no video at
  // all.
  useInlineWalkthroughClaim(Boolean(video?.mainVideoUrl || video?.youtubeUrl));

  if (isLoading) {
    // Same box to the pixel as the video that replaces it: `aspect-video
    // w-full` is the lib card's base geometry and the host `className` (which
    // actually sizes this slot) lands on both — sizing only one would show up
    // as a jump when the video arrives.
    return <Skeleton className={cn('aspect-video w-full rounded-md', className)} />;
  }

  return <InlineWalkthroughVideo video={video} className={className} />;
}
