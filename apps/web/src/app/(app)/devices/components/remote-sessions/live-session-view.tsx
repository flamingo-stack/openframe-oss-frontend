'use client';

import { NotFoundError, PageLayout } from '@flamingo-stack/openframe-frontend-core';
import { RemoteSessionStatusTag } from '@flamingo-stack/openframe-frontend-core/components/features';
import { MonitorOffIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { LoadError, LoadingWhen } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useNow } from '@/app/hooks/use-now';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { formatDateTime } from '@/lib/format-date';
import { loadErrorProps, queryState } from '@/lib/query-state';
import { routes } from '@/lib/routes';
import { useLiveSession } from '../../hooks/use-session-recordings';
import { SessionNotFoundError } from '../../services/session-recordings-service';
import type { LiveSessionDetail } from '../../types/session-recording';
import { formatDurationMs } from './format';
import { LiveSessionMetaCard } from './recording-meta-card';
import { RecordingWarningAlert } from './recording-storage-banner';
import { SessionChat } from './session-chat';
import { isAwaitingRecording } from './session-status';

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

/**
 * The stream's frame (Figma 1656-12080): the black screen with the host's bar along its top edge, and the strip under
 * it counting the session's time up. The picture itself joins it with the watch connection.
 */
function LiveStreamFrame({ session }: { session: LiveSessionDetail }) {
  const now = useNow(1000);
  const elapsedMs = Math.max(0, now - Date.parse(session.startedAt));
  return (
    <div className="flex flex-col overflow-hidden rounded-[6px] border border-ods-border">
      <div className="relative aspect-video w-full bg-black">
        <div className="absolute inset-x-[var(--spacing-system-l)] top-0 flex min-w-0 items-center gap-[var(--spacing-system-xsf)] rounded-b-[6px] border border-t-0 border-ods-border bg-ods-overlay px-[var(--spacing-system-sf)] py-[var(--spacing-system-xsf)]">
          <span className="min-w-0 truncate text-ods-text-primary text-h6">{`${session.employee.name} (host)`}</span>
        </div>
      </div>
      <div className="flex items-center bg-ods-card px-[var(--spacing-system-sf)] py-[var(--spacing-system-s)]">
        <span className="tabular-nums text-ods-text-primary text-h4">{formatDurationMs(elapsedMs)}</span>
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
 * technician running it opened the chat, the chat so far beside it (under it below desktop). The session is read
 * again every 10 s; when it ends the page turns into the recording's processing screen, and once a file is listed it
 * hands over to the recording page.
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
  const showChat = !!session && session.chat.length > 0;

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
            <LiveSessionMetaCard session={session ?? null} />
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
                    <LiveStreamFrame session={session} />
                  </>
                )}
              </div>
              {showChat && <SessionChat messages={session.chat} employee={session.employee} />}
            </div>
          )}
        </>
      )}
    </PageLayout>
  );
}
