'use client';

/**
 * The walkthrough video as the right half of the "Book a call" promo: the lib's
 * `<InlineWalkthroughVideo>` plus the one thing that is this page's job —
 * holding the 16:9 slot while the data loads.
 *
 * Renders nothing once the request settles with no video configured, letting
 * the copy span the card. Telling that apart from "not loaded yet" is what
 * `isLoading` is for.
 */

import { InlineWalkthroughVideo } from '@flamingo-stack/openframe-frontend-core/components/features';
import { Skeleton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { useWalkthroughVideoData } from '@/app/hooks/use-walkthrough-video-data';

export function BookCallWalkthroughVideo({ className }: { className?: string }) {
  const { video, isLoading } = useWalkthroughVideoData();

  if (isLoading) {
    // Same box to the pixel as the video that replaces it: `aspect-video
    // w-full` is the lib card's base geometry and the host `className` (which
    // actually sizes this slot) lands on both — sizing only one would show up
    // as a jump when the video arrives.
    return <Skeleton className={cn('aspect-video w-full rounded-md', className)} />;
  }

  return <InlineWalkthroughVideo video={video} className={className} />;
}
