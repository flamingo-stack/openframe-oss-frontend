'use client';

import { useEffect, useRef } from 'react';
import type { RemoteSessionFilter } from '@/__generated__/tenantRemoteSessionsRelayLiveQuery.graphql';
import { endedLiveRows, withPolledLiveRows } from '../components/remote-sessions/live-session-rows';
import type { TenantSessionRow } from '../components/remote-sessions/tenant-session-columns';
import { useLiveRows } from './use-remote-session-watch-gate';
import { useTenantLiveSessions } from './use-tenant-live-sessions';

interface TenantSessionRowsInput {
  /** The rows of the page on screen, in the server's order. */
  pageRows: TenantSessionRow[];
  /** The server's total for the list's scope, running sessions included. */
  totalCount: number;
  /** The list's filter. */
  filter: RemoteSessionFilter | null | undefined;
  /**
   * The page on screen is the first: the one that carries the running sessions. A later page never holds one, so
   * nothing is polled or merged there.
   */
  firstPage: boolean;
  /** Reads the page on screen again. */
  onRefresh: () => void;
}

interface TenantSessionRows {
  rows: TenantSessionRow[];
  totalCount: number;
}

/**
 * The rows the tenant-wide list shows, kept current while it is open. With Watch
 * live on, the running sessions are polled under the list's scope and lead the
 * first page, one row per session; one that started after the page came counts
 * in the total. A row the page still shows running that the poll no longer
 * returns has ended, and the page is read again, so the row leaves the LIVE
 * state within one poll. A state filter (KEPT, EXPIRING, EXPIRED) never matches
 * a running session, and the server lists none under it: nothing is polled then,
 * and nothing on a later page, which holds no running session either.
 */
export function useTenantSessionRows({
  pageRows,
  totalCount,
  filter,
  firstPage,
  onRefresh,
}: TenantSessionRowsInput): TenantSessionRows {
  const watchLive = useLiveRows() !== null;
  const { recordingState, ...scope } = filter ?? {};
  const polled = useTenantLiveSessions(watchLive && firstPage && !recordingState ? scope : null);

  const pageIds = new Set(pageRows.map(row => row.id));
  const startedSincePage = polled?.filter(row => !pageIds.has(row.id)).length ?? 0;

  // The list showed the previous poll's sessions too: one that started after the first page and has now ended
  // is on no page yet, and would leave the list instead of staying in it as an ended session.
  const previousPolled = useRef<TenantSessionRow[] | null>(null);
  // Once per session, so a server that answers the two reads differently cannot keep the list refetching.
  const refreshedFor = useRef(new Set<string>());
  useEffect(() => {
    const shown = withPolledLiveRows(pageRows, previousPolled.current);
    previousPolled.current = polled;
    if (!polled) return;
    const ended = endedLiveRows(shown, polled).filter(id => !refreshedFor.current.has(id));
    if (ended.length === 0) return;
    for (const id of ended) refreshedFor.current.add(id);
    onRefresh();
  }, [pageRows, polled, onRefresh]);

  return {
    rows: withPolledLiveRows(pageRows, polled),
    totalCount: totalCount + startedSincePage,
  };
}
