'use client';

/**
 * The walkthrough video as the right half of the "Book a call" promo: the lib's
 * `<InlineWalkthroughVideo>` plus the two things that are this page's job —
 * claiming the clip from the app-shell floating card so it isn't offered twice
 * at once, and the read: while it is in flight the lib card draws its own
 * loading state (its 16:9 slot) in a loading scope.
 *
 * Renders nothing once the request settles with no video configured, letting
 * the copy span the card. Telling that apart from "not loaded yet" is what
 * `isLoading` is for.
 */

import { InlineWalkthroughVideo } from '@flamingo-stack/openframe-frontend-core/components/features';
import { LoadingWhen } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useWalkthroughVideoData } from '@/app/hooks/use-walkthrough-video-data';
import { useInlineWalkthroughClaim } from '@/lib/inline-walkthrough-signal';

export function BookCallWalkthroughVideo({ className }: { className?: string }) {
  const { video, isLoading } = useWalkthroughVideoData();
  // Mirrors the lib's own render guard so the claim tracks what is actually on
  // screen — claiming with no playable source would leave the user no video at
  // all.
  useInlineWalkthroughClaim(Boolean(video?.mainVideoUrl || video?.youtubeUrl));

  // The clip is the point of the page: it starts on its own, muted, with the unmute glyph up.
  return (
    <LoadingWhen loading={isLoading}>
      <InlineWalkthroughVideo video={video} autoPlayCard className={className} />
    </LoadingWhen>
  );
}
