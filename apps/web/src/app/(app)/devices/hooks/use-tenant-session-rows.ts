'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { RemoteSessionFilter } from '@/__generated__/tenantRemoteSessionsRelayLiveQuery.graphql';
import { getRelayErrorCodes } from '@/lib/handle-api-error';
import { endedLiveRows, withPolledLiveRows } from '../components/remote-sessions/live-session-rows';
import type { TenantSessionRow } from '../components/remote-sessions/tenant-session-columns';
import { useLiveRows } from './use-remote-session-watch-gate';
import { useTenantLiveSessions } from './use-tenant-live-sessions';

/** How the server refuses a cursor it did not issue, or no longer takes. */
const INVALID_CURSOR = 'INVALID_CURSOR';

interface TenantSessionRowsInput {
  /** The rows of the pages loaded so far, in the server's order. */
  pageRows: TenantSessionRow[];
  /** The server's total for the list's scope, running sessions included. */
  totalCount: number;
  /** The list's filter. */
  filter: RemoteSessionFilter | null | undefined;
  /** Reads the first page again, back from wherever the list was paged to. */
  onRefresh: () => void;
}

interface TenantSessionRows {
  rows: TenantSessionRow[];
  totalCount: number;
  /** For the next page's load: a cursor the server refuses starts the list again from its first page. */
  onLoadMoreComplete: (error: Error | null) => void;
}

/**
 * The rows the tenant-wide list shows, kept current while it is open. With Watch
 * live on, the running sessions are polled under the list's scope and lead the
 * list, one row per session; one that started after the first page came counts
 * in the total. A row the list still shows running that the poll no longer
 * returns has ended, and the first page is read again, so the row leaves the
 * LIVE state within one poll. A state filter (KEPT, EXPIRING, EXPIRED) never
 * matches a running session, and the server lists none under it: nothing is
 * polled then.
 */
export function useTenantSessionRows({
  pageRows,
  totalCount,
  filter,
  onRefresh,
}: TenantSessionRowsInput): TenantSessionRows {
  const watchLive = useLiveRows() !== null;
  const { recordingState, ...scope } = filter ?? {};
  const polled = useTenantLiveSessions(watchLive && !recordingState ? scope : null);

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

  // A table left open across a release that changed the cursors starts again instead of failing the scroll.
  const onLoadMoreComplete = useCallback(
    (error: Error | null) => {
      if (error && getRelayErrorCodes(error).includes(INVALID_CURSOR)) onRefresh();
    },
    [onRefresh],
  );

  return {
    rows: withPolledLiveRows(pageRows, polled),
    totalCount: totalCount + startedSincePage,
    onLoadMoreComplete,
  };
}
