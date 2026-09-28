'use client';

import { PageLayout } from '@flamingo-stack/openframe-frontend-core';
import { LoadError } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { formatDateTime } from '@/lib/format-date';
import { loadErrorProps, queryState } from '@/lib/query-state';
import { routes } from '@/lib/routes';
import { useRemoteAccessMockTools } from '../../hooks/use-remote-access-mock-tools';
import { useSessionRecording } from '../../hooks/use-session-recordings';
import { sessionRecordingsApiService } from '../../services/session-recordings-api-service';
import { DevLocalFileLoader } from './dev-local-file-loader';
import { PlayerControls } from './player-controls';
import { RecordingMetaCard, RecordingMetaCardSkeleton } from './recording-meta-card';
import { RecordingPlayer } from './recording-player';
import { SessionChat } from './session-chat';
import { useRecordingPlayer } from './use-recording-player';

interface RemoteSessionViewProps {
  recordingId: string;
}

/**
 * The "Remote Session Recording" page (Figma 758-46350). This first iteration
 * carries the player itself - metadata card and session-chat transcript land
 * with the Remote Sessions tab (follow-up PR).
 *
 * Fullscreen lives here rather than in the player so the canvas never
 * remounts: the wrapper swaps to `fixed inset-0` and PageLayout hides its
 * header, same pattern as the live remote-desktop page.
 */
export function RemoteSessionView({ recordingId }: RemoteSessionViewProps) {
  const handleBack = useSafeBack(routes.devices.list);
  const { toast } = useToast();
  const recordingQuery = useSessionRecording(recordingId);
  const recording = recordingQuery.data;
  const { isLoading, isOffline, error: loadError } = queryState(recordingQuery);
  const player = useRecordingPlayer();
  // Nothing to show but the error - unless local files were loaded in the meantime.
  const failedToLoad = (!!loadError || isOffline) && player.state === 'empty';
  const searchParams = useSearchParams();
  // The local-file loader is not part of the design - it exists purely to test
  // the engine before the storage backend ships, so it hides behind the
  // temporary 'remote-access-mock-tools' flag plus an explicit `?dev=1`.
  const showMockTools = useRemoteAccessMockTools();
  const showDevLoader = showMockTools && searchParams.get('dev') === '1';

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    onFullscreenChange();
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      // Denied fullscreen (iframe/permissions) is not worth an error state.
    }
  };

  // Load the session's files once the detail arrives, oldest first: playback
  // starts on the first while the rest download one by one. When no file can
  // be fetched (still processing, or no storage) the
  // page shows the processing empty state, and in dev the local-file loader
  // can feed the player instead; a session missing only some files plays the
  // rest and says so.
  const { loadSegments } = player;
  useEffect(() => {
    if (!recording) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const { failed } = await loadSegments(
          recording.segments.map(segment => () => sessionRecordingsApiService.downloadSegment(segment)),
        );
        if (!cancelled && failed > 0) {
          toast({
            title: 'Part of the recording is missing',
            description: `${failed} of ${recording.segments.length} files of this session could not be loaded.`,
            variant: 'warning',
          });
        }
      } catch {
        if (!cancelled) setUnavailable(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [recording, loadSegments, toast]);

  return (
    <PageLayout
      className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
      backButton={{ label: 'Back', onClick: handleBack }}
      title="Remote Session Recording"
      subtitle={recording ? formatDateTime(recording.startedAt) : undefined}
      loading={isLoading}
      subtitleRow="while-loading"
      showHeader={!isFullscreen}
    >
      {/* Outside the player wrapper so it stays usable when the recording itself
          failed to load - local files are how that case gets tested. */}
      {showDevLoader && !isFullscreen && (
        <DevLocalFileLoader
          onLoad={async buffers => {
            await player.loadSegments(buffers.map(buffer => () => Promise.resolve(buffer)));
            setUnavailable(false);
          }}
        />
      )}
      {/* An unknown or hidden recording, or a failed read: the page has nothing to play. */}
      {failedToLoad && (
        <LoadError
          {...loadErrorProps(isOffline, "Couldn't load this recording.", () => void recordingQuery.refetch())}
        />
      )}
      <div
        className={cn(
          isFullscreen ? 'fixed inset-0 z-50 flex flex-col gap-0 bg-black' : 'contents',
          failedToLoad && 'hidden',
        )}
      >
        {!isFullscreen &&
          (isLoading ? <RecordingMetaCardSkeleton /> : recording && <RecordingMetaCard recording={recording} />)}
        {/* The player is ONE element per the mockup: the playback screen and
            the controls strip share a single bordered container. */}
        <div
          className={cn(
            'flex flex-col',
            isFullscreen ? 'min-h-0 flex-1' : 'overflow-hidden rounded-[6px] border border-ods-border',
          )}
        >
          <RecordingPlayer
            player={player}
            unavailable={unavailable}
            className={isFullscreen ? 'min-h-0 flex-1' : 'aspect-video'}
          />
          {/* No controls until a recording is actually loaded - the
              unavailable/processing screen (Figma 775-50606) is just the
              empty state on black. */}
          {player.state !== 'empty' && (
            <div className="bg-ods-card px-[var(--spacing-system-sf)] pb-[var(--spacing-system-xs)] pt-[var(--spacing-system-s)]">
              <PlayerControls
                state={player.state}
                currentMs={player.currentMs}
                durationMs={player.durationMs}
                speed={player.speed}
                isFullscreen={isFullscreen}
                onTogglePlay={player.togglePlay}
                onSeek={player.seek}
                onStepBack={player.stepBack}
                onStepForward={player.stepForward}
                onSetSpeed={player.setSpeed}
                onToggleFullscreen={() => void toggleFullscreen()}
              />
            </div>
          )}
        </div>
        {!isFullscreen && recording && <SessionChat messages={recording.chat} employee={recording.employee} />}
      </div>
    </PageLayout>
  );
}
