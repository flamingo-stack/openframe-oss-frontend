'use client';

import {
  type ActionsMenuGroup,
  NotFoundError,
  PageLayout,
  type PageActionButton,
} from '@flamingo-stack/openframe-frontend-core';
import {
  AssignTicketModal,
  KeepRecordingModal,
  ReleaseKeepingModal,
  RemoteSessionEventList,
  RemoteSessionTimelineMarkers,
  UnassignTicketModal,
} from '@flamingo-stack/openframe-frontend-core/components/features';
import {
  LockIcon,
  PlusCircleIcon,
  TrashIcon,
  UnlockIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { LoadError, LoadingWhen } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useDebounce, useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useEffectEvent, useState } from 'react';
import { useTicketSearchOptions } from '@/app/(app)/tickets/hooks/use-ticket-options';
import { safeBackOrReplace, useSafeBack } from '@/app/hooks/use-safe-back';
import { formatDate, formatDateTime } from '@/lib/format-date';
import { loadErrorProps, queryState } from '@/lib/query-state';
import { routes } from '@/lib/routes';
import {
  useAssignRecordingTickets,
  useRecordingTickets,
  useUnassignRecordingTicket,
} from '../../hooks/use-recording-tickets';
import { useRemoteAccessMockTools } from '../../hooks/use-remote-access-mock-tools';
import { useReportRecordingPlayed, useSessionEvents } from '../../hooks/use-session-events';
import {
  useDeleteRemoteSession,
  useKeepSessionRecording,
  useRecordingStorage,
  useReleaseSessionRecording,
  useSessionRecording,
} from '../../hooks/use-session-recordings';
import { MAX_ASSIGNED_TICKETS } from '../../services/recording-tickets-api-service';
import { sessionRecordingsApiService } from '../../services/session-recordings-api-service';
import { RecordingNotFoundError } from '../../services/session-recordings-service';
import { DeleteSessionDialog } from './delete-session-dialog';
import { DevLocalFileLoader } from './dev-local-file-loader';
import { PlayerControls } from './player-controls';
import { keepReasonText, keptUsageText, releaseDueOn } from './recording-keep';
import { RecordingMetaCard } from './recording-meta-card';
import { RecordingPlayer } from './recording-player';
import type { RecordingTicket } from './recording-tickets';
import { RecordingTicketsSection } from './recording-tickets-section';
import { SessionChat } from './session-chat';
import { activeSessionEventId, placeSessionEvents } from './session-events';
import { canDeleteSession, canKeepSession } from './session-status';
import { useRecordingPlayer } from './use-recording-player';

interface RemoteSessionViewProps {
  /** Null until the page knows it may ask (the recordings gate and the id): the view draws its loading state. */
  recordingId: string | null;
}

/**
 * The "Remote Session Recording" page (Figma 1728-42383 with the session chat,
 * 2164-113294 without it): the metadata card, then the player with the chat
 * transcript in a column beside it when the session had a chat, then the
 * Session Events list (the events also mark the player's track, and both
 * seek), then the tickets linked to the session.
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
  const query = queryState(recordingQuery);
  const { isOffline, error: loadError } = query;
  const isLoading = recordingId === null || query.isLoading;
  const player = useRecordingPlayer();
  // An unknown id, a deleted session, an expired or deleted file: the server
  // has nothing to show, which is a 404 rather than a load error to retry.
  const notFound = recordingQuery.error instanceof RecordingNotFoundError && player.state === 'empty';
  // Nothing to show but the error - unless local files were loaded in the meantime.
  const failedToLoad = (!!loadError || isOffline) && !notFound && player.state === 'empty';
  const searchParams = useSearchParams();
  // The local-file loader is not part of the design - it exists purely to test
  // the engine before the storage backend ships, so it hides behind the
  // temporary 'remote-access-mock-tools' flag plus an explicit `?dev=1`.
  const showMockTools = useRemoteAccessMockTools();
  const showDevLoader = showMockTools && searchParams.get('dev') === '1';

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isKeepOpen, setIsKeepOpen] = useState(false);
  const [isReleaseOpen, setIsReleaseOpen] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [ticketSearch, setTicketSearch] = useState('');
  const [unassignTarget, setUnassignTarget] = useState<RecordingTicket | null>(null);
  const router = useRouter();
  const deleteSession = useDeleteRemoteSession(recording?.deviceId ?? '');
  const keepRecording = useKeepSessionRecording(recording?.deviceId ?? '');
  const releaseRecording = useReleaseSessionRecording(recording?.deviceId ?? '');
  const storage = useRecordingStorage();
  const keep = recording?.keep ?? null;
  // Read once the page has the recording: a missing one has no timeline either.
  const events = placeSessionEvents(useSessionEvents(recording ? recordingId : null), player.timeline);
  const hasPlayback = player.state !== 'empty';
  const activeEventId = hasPlayback ? activeSessionEventId(events, player.currentMs) : null;
  useReportRecordingPlayed(recording?.id ?? null, player.state);
  const tickets = useRecordingTickets(recording ? recordingId : null).data ?? [];
  const assignTickets = useAssignRecordingTickets(recordingId ?? '');
  const unassignTicket = useUnassignRecordingTicket(recordingId ?? '');
  // The picker searches the tenant's tickets only while it is open, and offers none already linked.
  const ticketSearchResults = useTicketSearchOptions(useDebounce(ticketSearch, 300), undefined, isAssignOpen);
  const assignedTicketIds = new Set(tickets.map(ticket => ticket.id));
  const ticketOptions = ticketSearchResults.options.filter(option => !assignedTicketIds.has(option.value));

  // A session has a chat only when the technician and the employee wrote to each other during it, which most
  // sessions do not: while the recording is read the page draws the no-chat layout (the player across the page), and
  // a recording with a chat reflows into the two columns once it answers.
  const showChat = !isFullscreen && !!recording && recording.chat.length > 0;
  const unavailableNote = unavailable ? 'The video is still being processed, check back in a moment' : null;
  // Delete lives in the "..." menu, for a session the server would let go (ended, not processing, not kept).
  const menuActions: ActionsMenuGroup[] =
    sessionRecordingsApiService.canDelete && recording && canDeleteSession(recording)
      ? [
          {
            items: [
              {
                id: 'delete-session',
                label: 'Delete',
                // Per the design only the glyph is red; `danger` would colour the label too.
                icon: <TrashIcon className="h-full w-full text-ods-error" />,
                onClick: () => setIsDeleteOpen(true),
              },
            ],
          },
        ]
      : [];

  // Assign Ticket, then Keep Recording or Release Keeping once kept (Figma
  // 1755-93683 / 1755-94111); outline per the design, where `menu-primary`
  // would default to accent.
  const actions: PageActionButton[] = [];
  if (recording) {
    actions.push({
      label: 'Assign Ticket',
      icon: <PlusCircleIcon size={24} />,
      variant: 'outline',
      onClick: () => setIsAssignOpen(true),
    });
  }
  if (keep) {
    actions.push({
      label: 'Release Keeping',
      icon: <UnlockIcon size={24} />,
      variant: 'outline',
      onClick: () => setIsReleaseOpen(true),
    });
  } else if (recording && canKeepSession(recording)) {
    actions.push({
      label: 'Keep Recording',
      icon: <LockIcon size={24} />,
      variant: 'outline',
      onClick: () => setIsKeepOpen(true),
    });
  }

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
  const segmentsKey = recording ? `${recordingId}:${recording.segments.map(segment => segment.id).join(',')}` : '';
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
      actionsVariant="menu-primary"
      actions={actions}
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
      {notFound && <NotFoundError message="Recording not found" />}
      {/* A failed read: the page has nothing to play. */}
      {failedToLoad && (
        <LoadError
          {...loadErrorProps(isOffline, "Couldn't load this recording.", () => void recordingQuery.refetch())}
        />
      )}
      <div
        className={cn(
          isFullscreen ? 'fixed inset-0 z-50 flex flex-col gap-0 bg-black' : 'contents',
          (failedToLoad || notFound) && 'hidden',
        )}
      >
        {!isFullscreen && (isLoading || recording) && (
          <LoadingWhen loading={isLoading}>
            <RecordingMetaCard recording={recording ?? null} />
          </LoadingWhen>
        )}
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
                    markers={
                      events.length > 0 && (
                        <RemoteSessionTimelineMarkers
                          events={events}
                          durationMs={player.durationMs}
                          onSelect={event => player.seek(event.offsetMs)}
                        />
                      )
                    }
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
        {!isFullscreen && events.length > 0 && (
          <RemoteSessionEventList
            events={events}
            activeEventId={activeEventId}
            // A row seeks only once there is a recording to seek in.
            onSelect={hasPlayback ? event => player.seek(event.offsetMs) : undefined}
          />
        )}
        {/* With no ticket linked the whole section, title included, is left out. */}
        {!isFullscreen && tickets.length > 0 && (
          <RecordingTicketsSection tickets={tickets} onUnassign={setUnassignTarget} />
        )}
      </div>
      <AssignTicketModal
        isOpen={isAssignOpen}
        onClose={() => setIsAssignOpen(false)}
        options={ticketOptions}
        onSearch={setTicketSearch}
        loading={ticketSearchResults.isLoading}
        isPending={assignTickets.isPending}
        onConfirm={ticketIds => {
          if (!recording || ticketIds.length === 0) return;
          if (ticketIds.length > MAX_ASSIGNED_TICKETS) {
            toast({
              title: 'Too many tickets',
              description: `Assign up to ${MAX_ASSIGNED_TICKETS} tickets at a time.`,
              variant: 'destructive',
            });
            return;
          }
          assignTickets.mutate({ sessionId: recording.id, ticketIds }, { onSuccess: () => setIsAssignOpen(false) });
        }}
      />
      <UnassignTicketModal
        isOpen={unassignTarget !== null}
        onClose={() => setUnassignTarget(null)}
        isPending={unassignTicket.isPending}
        onConfirm={() => {
          if (!recording || !unassignTarget) return;
          unassignTicket.mutate(
            { sessionId: recording.id, ticketId: unassignTarget.id },
            { onSuccess: () => setUnassignTarget(null) },
          );
        }}
      />
      <KeepRecordingModal
        isOpen={isKeepOpen}
        onClose={() => setIsKeepOpen(false)}
        keptUsage={keptUsageText(storage.data)}
        isPending={keepRecording.isPending}
        onConfirm={selection => {
          if (!recording) return;
          keepRecording.mutate(
            { sessionId: recording.id, recordingId, selection },
            { onSuccess: () => setIsKeepOpen(false) },
          );
        }}
      />
      {keep && (
        <ReleaseKeepingModal
          isOpen={isReleaseOpen}
          onClose={() => setIsReleaseOpen(false)}
          keptBy={keep.keptBy}
          keptOn={formatDate(keep.keptAt)}
          reason={keepReasonText(keep)}
          expiresOn={formatDate(keep.expiresAtOnRelease)}
          dueOn={releaseDueOn(keep)}
          isPending={releaseRecording.isPending}
          onConfirm={() => {
            if (!recording) return;
            releaseRecording.mutate(
              { sessionId: recording.id, recordingId },
              { onSuccess: () => setIsReleaseOpen(false) },
            );
          }}
        />
      )}
      <DeleteSessionDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        startedAt={recording?.startedAt ?? null}
        isPending={deleteSession.isPending}
        onConfirm={() => {
          if (!recording) return;
          deleteSession.mutate(
            { sessionId: recording.id, recordingId },
            {
              // Back to the list the page was opened from (the device's tab or
              // the tenant-wide page), without the session; the device's tab
              // when there is none. A refusal is toasted and the page stays.
              onSuccess: () =>
                safeBackOrReplace(router, routes.devices.details(recording.deviceId, { tab: 'remote-sessions' })),
              onSettled: () => setIsDeleteOpen(false),
            },
          );
        }}
      />
    </PageLayout>
  );
}
