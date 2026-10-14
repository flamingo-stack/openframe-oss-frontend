'use client';

import { skipToken, useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import type { RecordingPlayerState } from '@/lib/meshcentral/recording';
import type { SessionTimelineEvent } from '../components/remote-sessions/session-events';
import { fetchSessionEventsPage, recordRecordingPlayed } from '../services/remote-session-events-api-service';
import { deviceQueryKeys } from '../utils/query-keys';

/** A runaway timeline stops here (500 rows a page); a usual session fits the first. */
const MAX_PAGES = 20;

/**
 * The rows of the Session Events list, oldest first. The first page comes
 * with the page; the rest load one after another in the background, and the
 * list and the markers fill in as they arrive.
 */
export function useSessionEvents(recordingId: string | null): SessionTimelineEvent[] {
  const query = useInfiniteQuery({
    queryKey: deviceQueryKeys.sessionEvents(recordingId ?? ''),
    queryFn: recordingId ? ({ pageParam }) => fetchSessionEventsPage(recordingId, pageParam) : skipToken,
    initialPageParam: null as string | null,
    getNextPageParam: (last, pages) => (pages.length < MAX_PAGES ? last.nextCursor : null),
  });
  const { hasNextPage, isFetchingNextPage, isError, fetchNextPage } = query;

  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && !isError) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, isError, fetchNextPage]);

  return query.data?.pages.flatMap(page => page.events) ?? [];
}

/**
 * Reports the first playback of the page to the session's timeline, once per
 * session the page shows. Fire and forget: the server dedupes by user, session
 * and hour, and a refusal or a failed request changes nothing for the viewer.
 */
export function useReportRecordingPlayed(sessionId: string | null, state: RecordingPlayerState): void {
  const reportedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!sessionId || state !== 'playing' || reportedRef.current === sessionId) return;
    reportedRef.current = sessionId;
    recordRecordingPlayed(sessionId).catch(() => {});
  }, [sessionId, state]);
}
