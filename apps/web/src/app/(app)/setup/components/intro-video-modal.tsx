'use client';

import { InlineWalkthroughVideo } from '@flamingo-stack/openframe-frontend-core/components/features';
import { SimpleModal } from '@/app/components/shared/simple-modal';
import { useWalkthroughVideoData } from '@/app/hooks/use-walkthrough-video-data';
import { useInlineWalkthroughClaim } from '@/lib/inline-walkthrough-signal';

/**
 * "Watch a 1-minute intro": the platform's walkthrough clip in a modal. The
 * same data the app-shell floating card plays; while this is open the clip is
 * claimed so that card does not offer it a second time.
 */
export function IntroVideoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { video } = useWalkthroughVideoData();
  useInlineWalkthroughClaim(open && Boolean(video?.mainVideoUrl || video?.youtubeUrl));

  return (
    <SimpleModal isOpen={open} onClose={onClose} title="Watch a 1-minute intro" className="md:max-w-[800px]">
      <InlineWalkthroughVideo video={video} autoPlayCard className="w-full" />
    </SimpleModal>
  );
}
