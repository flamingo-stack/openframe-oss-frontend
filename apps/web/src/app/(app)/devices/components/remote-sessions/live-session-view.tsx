'use client';

import { NotFoundError, PageLayout } from '@flamingo-stack/openframe-frontend-core';
import {
  RemoteSessionStatusTag,
  type RemoteSessionViewer,
  RemoteSessionViewers,
} from '@flamingo-stack/openframe-frontend-core/components/features';
import {
  Collapse02Icon,
  Expand02Icon,
  MonitorIcon,
  MonitorOffIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Button,
  LIVE_PULSE_CLASS,
  LoadError,
  LoadingWhen,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';
import { useNow } from '@/app/hooks/use-now';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { formatDateTime } from '@/lib/format-date';
import { loadErrorProps, queryState } from '@/lib/query-state';
import { routes } from '@/lib/routes';
import { useRemoteSessionChat } from '../../hooks/use-remote-session-chat';
import { type UseRemoteSessionWatchResult, useRemoteSessionWatch } from '../../hooks/use-remote-session-watch';
import { useLiveSession } from '../../hooks/use-session-recordings';
import { SessionNotFoundError } from '../../services/session-recordings-service';
import { toRecordingChatMessage } from '../../types/remote-session-chat';
import type { LiveSessionDetail } from '../../types/session-recording';
import { formatDurationMs } from './format';
import { LiveSessionMetaCard } from './recording-meta-card';
import { RecordingWarningAlert } from './recording-storage-banner';
import { SessionChat } from './session-chat';
import { isAwaitingRecording } from './session-status';
import { sessionViewers } from './session-viewers';

interface LiveSessionViewProps {
  /** Null until the page knows it may ask (the Watch live gate and the id): the view draws its loading state. */
  sessionId: string | null;
}

/** The tag beside the title: LIVE while the session runs, then where its recording stands. */
function titleTag(session: LiveSessionDetail): 'live' | 'processing' | 'failed' | null {
  if (session.live) return 'live';
  if (isAwaitingRecording(session)) return 'processing';
  return session.recordingState === 'failed' ? 'failed' : null;
}

/** The section label over the stream: shown beside a chat, and over the ended screen. */
function SectionLabel({ children }: { children: string }) {
  return <span className="text-ods-text-secondary text-h5">{children}</span>;
}

/** The agent reports display ids only, no monitor names: the same label Remote Control and the timeline use. */
function displayLabel(displayId: number): string {
  return `Display ${displayId}`;
}

/** While the watch socket pairs, or comes back after a drop: the three-dot pulse Remote Control shows. */
function ConnectingOverlay() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-[var(--spacing-system-sf)]">
      <span className="flex items-center gap-[var(--spacing-system-xxs)]">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className={cn('size-1 rounded-full bg-ods-text-secondary', LIVE_PULSE_CLASS)}
            style={{ animationDelay: `${i * 250}ms` }}
          />
        ))}
      </span>
      <span className="text-ods-text-secondary text-h6">Connecting to the live session</span>
    </div>
  );
}

/** The page stopped trying (failed dials in a row, or watching is off): the ended screen's look, with a retry. */
function UnavailableOverlay({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-[var(--spacing-system-xsf)] bg-ods-bg p-[var(--spacing-system-m)] text-center">
      <MonitorOffIcon className="h-6 w-6 text-ods-text-secondary" />
      <span className="text-ods-text-secondary text-h4">Live view unavailable</span>
      <span className="text-ods-text-secondary text-h6">Couldn&apos;t show this session&apos;s screen.</span>
      <Button variant="outline" onClick={onRetry} className="mt-[var(--spacing-system-xsf)]">
        Retry
      </Button>
    </div>
  );
}

/** Whether `element` is the page's fullscreen element, kept current. */
function useIsFullscreen(element: HTMLElement | null): boolean {
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    const onChange = () => setFullscreen(element !== null && document.fullscreenElement === element);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, [element]);
  return fullscreen;
}

interface LiveStreamFrameProps extends Pick<UseRemoteSessionWatchResult, 'state' | 'display' | 'retry'> {
  session: LiveSessionDetail;
  viewers: RemoteSessionViewer[];
  /** The watch's canvas callback ref. */
  attachCanvas: UseRemoteSessionWatchResult['attachCanvas'];
}

/**
 * The stream's frame (Figma 1656-12080, 1755-95212): the host's screen as the watch socket draws it, with the host's
 * bar along its top edge (the host, the display shown, who is watching) and the strip under it counting the session's
 * time up, with fullscreen. Nothing in it reaches the device: no input, no display or quality control.
 */
function LiveStreamFrame({ session, state, display, retry, viewers, attachCanvas }: LiveStreamFrameProps) {
  const now = useNow(1000);
  const elapsedMs = Math.max(0, now - Date.parse(session.startedAt));
  const [frame, setFrame] = useState<HTMLDivElement | null>(null);
  const fullscreen = useIsFullscreen(frame);
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void frame?.requestFullscreen?.();
  };
  return (
    <div
      ref={setFrame}
      className={cn('flex flex-col overflow-hidden border border-ods-border bg-black', !fullscreen && 'rounded-[6px]')}
    >
      <div className={cn('relative w-full bg-black', fullscreen ? 'min-h-0 flex-1' : 'aspect-video')}>
        <canvas
          ref={attachCanvas}
          aria-label={`${session.employee.name}'s screen`}
          className={cn('absolute inset-0 h-full w-full object-contain', state !== 'streaming' && 'invisible')}
        />
        {state === 'connecting' && <ConnectingOverlay />}
        {state === 'unavailable' && <UnavailableOverlay onRetry={retry} />}
        <div className="absolute inset-x-[var(--spacing-system-l)] top-0 flex min-w-0 items-center gap-[var(--spacing-system-xsf)] rounded-b-[6px] border border-t-0 border-ods-border bg-ods-overlay px-[var(--spacing-system-sf)] py-[var(--spacing-system-xsf)]">
          <span className="min-w-0 truncate text-ods-text-primary text-h6">{`${session.employee.name} (host)`}</span>
          {display !== null && (
            <span className="flex shrink-0 items-center gap-[var(--spacing-system-xxs)] rounded-[6px] border border-ods-border bg-ods-card px-[var(--spacing-system-xsf)] py-[var(--spacing-system-xxs)] text-ods-text-primary text-code">
              <MonitorIcon className="h-4 w-4 text-ods-text-secondary" />
              {displayLabel(display)}
            </span>
          )}
          <RemoteSessionViewers viewers={viewers} className="ml-auto" />
        </div>
      </div>
      <div className="flex items-center justify-between bg-ods-card px-[var(--spacing-system-sf)] py-[var(--spacing-system-s)]">
        <span className="tabular-nums text-ods-text-primary text-h4">{formatDurationMs(elapsedMs)}</span>
        <Button
          variant="transparent"
          size="icon"
          aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          onClick={toggleFullscreen}
          leftIcon={fullscreen ? <Collapse02Icon /> : <Expand02Icon />}
        />
      </div>
    </div>
  );
}

/** The ended session's screen (Figma 1755-96417): the session is over, and its recording is on its way if it has one. */
function SessionEndedScreen({ processing }: { processing: boolean }) {
  return (
    <div className="flex aspect-video w-full flex-col items-center justify-center gap-[var(--spacing-system-xsf)] rounded-[6px] border border-ods-border bg-ods-bg p-[var(--spacing-system-m)] text-center">
      <MonitorOffIcon className="h-6 w-6 text-ods-text-secondary" />
      <span className="text-ods-text-secondary text-h4">Session ended</span>
      {processing && (
        <span className="text-ods-text-secondary text-h6">
          The recording is being processed and will be ready in a few minutes.
        </span>
      )}
    </div>
  );
}

/**
 * The live session page: a session running on a device, opened from its LIVE row or a link, by the session id. The
 * meta card, the "not being recorded" banner when the recording storage was full, the stream's frame and, once the
 * technician running it opened the chat, the chat beside it (under it below desktop), followed live and read-only: a
 * watcher cannot post, and nothing here marks the dialog read. The session is read again every 10 s; when it ends the
 * page turns into the recording's processing screen, and once a file is listed it hands over to the recording page.
 */
export function LiveSessionView({ sessionId }: LiveSessionViewProps) {
  const handleBack = useSafeBack(routes.devices.list);
  const router = useRouter();
  const sessionQuery = useLiveSession(sessionId);
  const session = sessionQuery.data;
  const query = queryState(sessionQuery);
  const { isOffline, error: loadError } = query;
  const isLoading = sessionId === null || query.isLoading;
  const notFound = sessionQuery.error instanceof SessionNotFoundError;
  const failedToLoad = (!!loadError || isOffline) && !notFound;

  // An ended session with a file to play is the recording page's from here on.
  const handoverRecordingId =
    session && !session.live && session.recordingState === 'ready' ? session.recordingId : null;
  useEffect(() => {
    if (handoverRecordingId) router.replace(routes.devices.remoteSessionRecording(handoverRecordingId));
  }, [handoverRecordingId, router]);

  const ended = !!session && !session.live;
  const tag = session ? titleTag(session) : null;
  // The technician's lines are the host's: the session's, not the signed-in watcher's. The dialog stays the same once
  // the session ended, so the processing screen keeps the chat until the recording page takes over.
  const host = session ? { name: session.employee.name, avatarUrl: session.employee.avatarUrl } : undefined;
  const chat = useRemoteSessionChat(session?.dialogId ?? null, true, host);
  // Memoized on purpose: SessionChat scrolls to the end whenever its transcript changes identity, so a re-render of
  // this page (the poll, the watch) must hand it the same array, or a reader scrolled back up is snapped down.
  const messages = useMemo(() => chat.messages.map(toRecordingChatMessage), [chat.messages]);
  const showChat = !!session && messages.length > 0;

  const userId = useAuthStore(s => s.user?.id ?? null);
  const watch = useRemoteSessionWatch(sessionId, !!session?.live);
  const viewers = session
    ? sessionViewers(
        { id: session.technicianId, name: session.employee.name, avatarUrl: session.employee.avatarUrl ?? null },
        watch.viewers,
        userId,
      )
    : [];
  const resolution = watch.resolution ? `${watch.resolution.width} × ${watch.resolution.height}` : undefined;

  return (
    <PageLayout
      className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
      backButton={{ label: 'Back', onClick: handleBack }}
      title={ended ? 'Remote Session Recording' : 'Live session'}
      titleAdornment={tag && <RemoteSessionStatusTag status={tag} />}
      subtitle={session ? formatDateTime(session.startedAt) : undefined}
      loading={isLoading}
      subtitleRow="while-loading"
    >
      {notFound && <NotFoundError message="Session not found" />}
      {failedToLoad && (
        <LoadError {...loadErrorProps(isOffline, "Couldn't load this session.", () => void sessionQuery.refetch())} />
      )}
      {!notFound && !failedToLoad && (
        <>
          {session?.notRecorded && (
            <RecordingWarningAlert data-loading-optional>
              This session isn&apos;t being recorded. Recording storage is full. New sessions aren&apos;t recorded until
              space is freed.
            </RecordingWarningAlert>
          )}
          <LoadingWhen loading={isLoading}>
            <LiveSessionMetaCard session={session ?? null} resolution={resolution} />
          </LoadingWhen>
          {session && (
            <div
              data-loading-optional
              className={cn(
                'grid grid-cols-1 gap-[var(--spacing-system-l)]',
                showChat && 'content-lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]',
              )}
            >
              <div className="flex min-w-0 flex-col gap-[var(--spacing-system-xxs)]">
                {ended ? (
                  <>
                    <SectionLabel>Video Session Recording</SectionLabel>
                    <SessionEndedScreen processing={isAwaitingRecording(session)} />
                  </>
                ) : (
                  <>
                    {showChat && <SectionLabel>Live Session</SectionLabel>}
                    <LiveStreamFrame
                      session={session}
                      state={watch.state}
                      display={watch.display}
                      retry={watch.retry}
                      viewers={viewers}
                      attachCanvas={watch.attachCanvas}
                    />
                  </>
                )}
              </div>
              {showChat && <SessionChat messages={messages} employee={session.employee} />}
            </div>
          )}
        </>
      )}
    </PageLayout>
  );
}
