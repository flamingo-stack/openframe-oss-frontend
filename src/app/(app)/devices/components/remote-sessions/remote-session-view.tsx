'use client';

import { PageLayout } from '@flamingo-stack/openframe-frontend-core';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { formatDateTime } from '@/lib/format-date';
import { routes } from '@/lib/routes';
import { useSessionRecording } from '../../hooks/use-session-recordings';
import { RecordingUnavailableError, sessionRecordingsService } from '../../services/session-recordings-service';
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
 * with the Remote Sessions tab (same CU-86akc3ce5, follow-up PR).
 *
 * Fullscreen lives here rather than in the player so the canvas never
 * remounts: the wrapper swaps to `fixed inset-0` and PageLayout hides its
 * header, same pattern as the live remote-desktop page.
 */
export function RemoteSessionView({ recordingId }: RemoteSessionViewProps) {
  const handleBack = useSafeBack(routes.devices.list);
  const { data: recording, isLoading } = useSessionRecording(recordingId);
  const player = useRecordingPlayer();
  const searchParams = useSearchParams();
  // The local-file loader is not part of the design - it exists purely to test
  // the engine before the storage backend ships, so it hides behind an
  // explicit `?dev=1` on top of being dev-build-only.
  const showDevLoader = process.env.NODE_ENV === 'development' && searchParams.get('dev') === '1';

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

  // Fetch the .mcrec once the detail arrives. The mock service always throws
  // RecordingUnavailableError (no storage backend yet) - the page then shows
  // the processing empty state, and in dev the local-file loader feeds the
  // player instead.
  const { loadBuffer } = player;
  useEffect(() => {
    if (!recording) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const buffer = await sessionRecordingsService.downloadRecording(recording);
        if (!cancelled) await loadBuffer(buffer);
      } catch (error) {
        if (!cancelled && error instanceof RecordingUnavailableError) setUnavailable(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [recording, loadBuffer]);

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
      <div className={isFullscreen ? 'fixed inset-0 z-50 flex flex-col gap-0 bg-black' : 'contents'}>
        {showDevLoader && !isFullscreen && (
          <DevLocalFileLoader
            onLoad={async buffer => {
              await player.loadBuffer(buffer);
              setUnavailable(false);
            }}
          />
        )}
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
