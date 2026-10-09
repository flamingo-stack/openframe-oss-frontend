'use client';

import { type ActionsMenuGroup, PageLayout } from '@flamingo-stack/openframe-frontend-core';
import { TrashIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { LoadError } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useEffectEvent, useState } from 'react';
import { ConfirmDialog } from '@/app/components/shared/confirm-dialog';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { formatDateTime } from '@/lib/format-date';
import { loadErrorProps, queryState } from '@/lib/query-state';
import { routes } from '@/lib/routes';
import { useRemoteAccessMockTools } from '../../hooks/use-remote-access-mock-tools';
import { useDeleteSessionRecording, useSessionRecording } from '../../hooks/use-session-recordings';
import { sessionRecordingsApiService } from '../../services/session-recordings-api-service';
import { DevLocalFileLoader } from './dev-local-file-loader';
import { PlayerControls } from './player-controls';
import { RecordingMetaCard, RecordingMetaCardSkeleton } from './recording-meta-card';
import { RecordingPlayer } from './recording-player';
import { SessionChat } from './session-chat';
import { canDeleteSession, isRecordingGone, recordingUnavailableNote } from './session-status';
import { useRecordingPlayer } from './use-recording-player';

interface RemoteSessionViewProps {
  recordingId: string;
}

/**
 * The "Remote Session Recording" page (Figma 1728-42383 with the session chat,
 * 2164-113294 without it): the metadata card, then the player with the chat
 * transcript in a column beside it when the session had a chat.
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
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const router = useRouter();
  const deleteRecording = useDeleteSessionRecording(recording?.deviceId ?? '');

  const showChat = !isFullscreen && !!recording && recording.chat.length > 0;
  // A deleted or expired recording has no files left to fetch: the page says
  // so from the session's state instead of waiting on downloads that 410.
  const gone = !!recording && isRecordingGone(recording);
  const unavailableNote = recording ? recordingUnavailableNote(recording, unavailable) : null;
  // Delete lives in the "..." menu, for a recording the server would let go (not kept).
  const menuActions: ActionsMenuGroup[] =
    sessionRecordingsApiService.canDelete && recording && canDeleteSession(recording)
      ? [
          {
            items: [
              {
                id: 'delete-recording',
                label: 'Delete',
                // Per the design only the glyph is red; `danger` would colour the label too.
                icon: <TrashIcon className="h-full w-full text-ods-error" />,
                onClick: () => setIsDeleteOpen(true),
              },
            ],
          },
        ]
      : [];

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
  // Keyed on the session's files, not on the query result: a background
  // refetch hands back an equal detail as a new object, and reloading the same
  // files into the player restarts playback for nothing. The player's own
  // callbacks are not stable across renders either, hence the effect event.
  const segmentsKey =
    recording && !gone ? `${recordingId}:${recording.segments.map(segment => segment.id).join(',')}` : '';
  const loadFiles = useEffectEvent(async () => {
    if (!recording) return { failed: 0, total: 0 };
    const { failed } = await player.loadSegments(
      recording.segments.map(segment => () => sessionRecordingsApiService.downloadSegment(segment)),
    );
    return { failed, total: recording.segments.length };
  });
  useEffect(() => {
    if (!segmentsKey) return undefined;
    let cancelled = false;
    void (async () => {
      try {
        const { failed, total } = await loadFiles();
        if (!cancelled && failed > 0) {
          toast({
            title: 'Part of the recording is missing',
            description: `${failed} of ${total} files of this session could not be loaded.`,
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
  }, [segmentsKey, toast]);

  return (
    <PageLayout
      className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
      backButton={{ label: 'Back', onClick: handleBack }}
      title="Remote Session Recording"
      subtitle={recording ? formatDateTime(recording.startedAt) : undefined}
      loading={isLoading}
      subtitleRow="while-loading"
      showHeader={!isFullscreen}
      menuActions={menuActions}
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
        {/* With a chat the player and the transcript are two columns on
            desktop, each under its own label; without one the player spans
            the page. */}
        <div
          className={cn(
            showChat ? 'grid gap-[var(--spacing-system-l)] content-lg:grid-cols-[minmax(0,1fr)_400px]' : 'contents',
          )}
        >
          <div className={cn(showChat ? 'flex min-w-0 flex-col gap-[var(--spacing-system-xxs)]' : 'contents')}>
            {showChat && <span className="text-ods-text-secondary text-h5">Video Session Recording</span>}
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
                unavailableNote={unavailableNote}
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
          </div>
          {showChat && <SessionChat messages={recording.chat} employee={recording.employee} />}
        </div>
      </div>
      <ConfirmDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title="Delete Recording"
        description={
          <>
            Are you sure you want to delete the session recording from{' '}
            <span className="font-medium text-ods-accent">{recording ? formatDateTime(recording.startedAt) : ''}</span>?
            This cannot be undone.
          </>
        }
        confirmLabel="Delete Recording"
        variant="destructive"
        isPending={deleteRecording.isPending}
        onConfirm={() => {
          if (!recording) return;
          deleteRecording.mutate(
            { sessionId: recording.id, recordingId },
            {
              onSuccess: () => {
                setIsDeleteOpen(false);
                router.replace(routes.devices.details(recording.deviceId, { tab: 'remote-sessions' }));
              },
            },
          );
        }}
      />
    </PageLayout>
  );
}
