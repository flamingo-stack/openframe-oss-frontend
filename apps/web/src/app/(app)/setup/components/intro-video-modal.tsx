'use client';

import { Video } from '@flamingo-stack/openframe-frontend-core/components/features';
import { SimpleModal } from '@/app/components/shared/simple-modal';
import { useWalkthroughVideoData } from '@/app/hooks/use-walkthrough-video-data';
import { useInlineWalkthroughClaim } from '@/lib/inline-walkthrough-signal';

/**
 * "Watch a 1-minute intro": the platform's walkthrough clip in a modal. The
 * same data the app-shell floating card plays; while this is open the clip is
 * claimed so that card does not offer it a second time.
 *
 * The player is the theater's own, with its full control row, drawn straight
 * in the modal. It waits on its poster for the viewer's Play (no autoplay: the
 * poster flashing into a running clip read as a glitch), and full screen is
 * the player's button, pressed by the viewer. The collapsed card with its
 * separate theater is for a page the clip floats over; here the modal already
 * is the stage, and closing a theater over it left the card playing
 * underneath.
 */
export function IntroVideoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { video } = useWalkthroughVideoData();
  const url = video?.youtubeUrl || video?.mainVideoUrl;
  useInlineWalkthroughClaim(open && Boolean(url));

  return (
    <SimpleModal isOpen={open} onClose={onClose} title="Watch a 1-minute intro" className="md:max-w-[800px]">
      {open && url && (
        <Video
          kind={video?.youtubeUrl ? 'youtube' : 'file'}
          url={url}
          poster={video?.posterUrl}
          captionsUrl={video?.captionsUrl}
          title={video?.title ?? undefined}
          layout="wide"
          preload="auto"
          className="w-full"
        />
      )}
    </SimpleModal>
  );
}
