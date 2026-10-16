'use client';

import { useOptionalNotifications } from '@flamingo-stack/openframe-frontend-core/components/features';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useMingoChat } from '@/app/(app)/mingo/providers/mingo-chat-provider';
import { BOARD_PAGE_SIZE } from '@/app/(app)/tickets/hooks/use-tickets-board-query';
import { ticketService } from '@/app/(app)/tickets/services';
import { useTicketStatusesQuery } from '@/app/(app)/tickets/statuses/hooks/use-ticket-statuses-query';
import { dialogsQueryKeys } from '@/app/(app)/tickets/utils/query-keys';
import { useSubscriptionOpen } from '@/app/components/subscription-lock/subscription-guard';
import { isSaasTenantMode } from '@/lib/app-mode';
import { loadErrorProps, queryState } from '@/lib/query-state';
import { useApprovalDecisions } from './approval-decisions';
import { APPROVAL_DIALOGS_QUERY_KEY, fetchApprovalDialogs } from './approval-dialogs-query';
import { type ApprovalSources, techRequiredStatusId } from './approval-inbox';

/** As often as the chat list re-reads itself; a live event refreshes sooner (below). */
const POLL_MS = 60_000;

/** The unfiltered lane, exactly as the board keys and fetches it, so both read one cache. */
const UNFILTERED_LANE = {};

export interface SourceStatus {
  /** First load in flight: draw the section's placeholders. */
  isLoading: boolean;
  /** Nothing loaded and the load failed (or the link is down): the section's strip. */
  error: { message: string; onRetry?: () => void } | null;
  /** Answered with data, so an empty section is really empty — of what is loaded (`hasMore`). */
  canClaimEmpty: boolean;
  /** Rows of the source loaded so far: what an empty section has looked through while `hasMore`. */
  loaded: number;
  hasMore: boolean;
  isLoadingMore: boolean;
  loadMore: () => void;
}

export interface ApprovalSourcesResult {
  sources: ApprovalSources;
  requests: SourceStatus;
  tickets: SourceStatus;
  /** Tickets exist in this mode (SaaS); false hides the tickets section. */
  ticketsEnabled: boolean;
  /** The tenant's Tech Required status, once the statuses answered. */
  techRequiredStatusId: string | null;
}

/** A source this mode does not have: answered, empty, nothing more to load. */
const SETTLED: SourceStatus = {
  isLoading: false,
  error: null,
  canClaimEmpty: true,
  loaded: 0,
  hasMore: false,
  isLoadingMore: false,
  loadMore: () => {},
};

const NO_NOTIFICATIONS: never[] = [];
const NO_ROWS: never[] = [];

/**
 * The data behind the Needs approval page and its sidebar badge, read from caches other
 * surfaces already hold where one exists:
 * - the drawer's notifications: the lib provider's state, no request of its own;
 * - the Tech Required lane: the board's own query for its unfiltered lane (same key, same
 *   pages), after the ticket statuses the board also caches;
 * - Mingo chats waiting on an approval: one query, shared by every caller through its key.
 *
 * Both queries poll at the chat list's pace while a caller is mounted (the badge is, for
 * the whole Mingo-first session), and refetch at once when something they cannot see
 * moves: a new or resolved approval notification, the open chat starting or ending a wait,
 * a decision made on any surface. Nothing runs behind the subscription lock, before the
 * chat session is up, or — for the chat service's data — outside SaaS.
 */
export function useApprovalSources(): ApprovalSourcesResult {
  const queryClient = useQueryClient();
  const subscriptionOpen = useSubscriptionOpen();
  const { chat, enabled: chatEnabled } = useMingoChat();
  const saas = isSaasTenantMode();
  const live = subscriptionOpen && chatEnabled;

  const notifications = useOptionalNotifications()?.notifications ?? NO_NOTIFICATIONS;
  const decisions = useApprovalDecisions();

  const dialogsQuery = useInfiniteQuery({
    queryKey: APPROVAL_DIALOGS_QUERY_KEY,
    queryFn: ({ pageParam }) => fetchApprovalDialogs(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: lastPage =>
      lastPage.pageInfo.hasNextPage ? (lastPage.pageInfo.endCursor ?? undefined) : undefined,
    enabled: live && saas,
    refetchInterval: POLL_MS,
  });

  const statusesQuery = useTicketStatusesQuery({ enabled: live && saas });
  const laneId = techRequiredStatusId(statusesQuery.data?.snapshot);
  const laneQuery = useInfiniteQuery({
    queryKey: dialogsQueryKeys.boardColumn(laneId ?? '', UNFILTERED_LANE),
    queryFn: ({ pageParam }) =>
      ticketService.fetchBoardColumnByStatusId({ statusId: laneId ?? '', cursor: pageParam, limit: BOARD_PAGE_SIZE }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: lastPage =>
      lastPage.pageInfo.hasNextPage ? (lastPage.pageInfo.endCursor ?? undefined) : undefined,
    enabled: live && saas && laneId !== null,
    refetchInterval: POLL_MS,
  });

  // What the queries cannot see change: the drawer's pending approval notifications, the
  // chat list's live "waiting for approval" rows (the open chat's comes from its stream,
  // and a chat on screen gets no notification), and the decisions. Skipped on the first
  // run — the queries are loading anyway — and `cancelRefetch: false` folds the sidebar's
  // and the page's identical reactions into one request.
  const liveApprovalChats = (chat?.state.dialogs ?? NO_ROWS)
    .filter(dialog => chat?.dialogStatusOf(dialog) === 'approval')
    .map(dialog => `chat:${dialog.id}`);
  const pendingNotifications = notifications
    .filter(notification => !notification.read && typeof notification.meta?.approvalRequestId === 'string')
    .map(notification => `request:${String(notification.meta?.approvalRequestId)}`);
  const decided = Object.keys(decisions).map(id => `decided:${id}`);
  const signal = [...pendingNotifications, ...liveApprovalChats, ...decided].sort().join(',');
  const lastSignal = useRef<string | null>(null);
  useEffect(() => {
    const previous = lastSignal.current;
    lastSignal.current = signal;
    if (previous === null || previous === signal || !live || !saas) return;
    void queryClient.invalidateQueries({ queryKey: APPROVAL_DIALOGS_QUERY_KEY }, { cancelRefetch: false });
    if (laneId) {
      void queryClient.invalidateQueries(
        { queryKey: dialogsQueryKeys.boardColumn(laneId, UNFILTERED_LANE) },
        { cancelRefetch: false },
      );
    }
  }, [signal, live, saas, laneId, queryClient]);

  const dialogsState = queryState(dialogsQuery, saas ? 'open' : 'closed');
  const statusesState = queryState(statusesQuery, saas ? 'open' : 'closed');
  const laneState = queryState(laneQuery, saas ? 'open' : 'closed');

  const dialogs = dialogsQuery.data?.pages.flatMap(page => page.dialogs) ?? NO_ROWS;
  const tickets = laneQuery.data?.pages.flatMap(page => page.dialogs) ?? NO_ROWS;

  const requestsStatus: SourceStatus = saas
    ? {
        isLoading: dialogsState.isLoading,
        error:
          dialogsState.error || dialogsState.isOffline
            ? loadErrorProps(
                dialogsState.isOffline,
                "Couldn't load the approval requests.",
                () => void dialogsQuery.refetch(),
              )
            : null,
        canClaimEmpty: dialogsState.canClaimEmpty,
        loaded: dialogs.length,
        hasMore: dialogsQuery.hasNextPage,
        isLoadingMore: dialogsQuery.isFetchingNextPage,
        loadMore: () => void dialogsQuery.fetchNextPage(),
      }
    : SETTLED;

  const statusesFailed = statusesState.error !== null || statusesState.isOffline;
  // A tenant without a Tech Required status has no such lane: nothing to wait for.
  const noLane = statusesState.hasData && laneId === null;
  const ticketsStatus: SourceStatus = saas
    ? {
        // The lane query waits for the statuses; with no lane to read it never runs.
        isLoading: statusesState.isLoading || (laneId !== null && laneState.isLoading),
        error:
          statusesFailed || laneState.error || laneState.isOffline
            ? loadErrorProps(
                statusesState.isOffline || laneState.isOffline,
                "Couldn't load the tickets waiting for a technician.",
                () => void (statusesFailed ? statusesQuery.refetch() : laneQuery.refetch()),
              )
            : null,
        canClaimEmpty: noLane || laneState.canClaimEmpty,
        loaded: tickets.length,
        hasMore: laneQuery.hasNextPage,
        isLoadingMore: laneQuery.isFetchingNextPage,
        loadMore: () => void laneQuery.fetchNextPage(),
      }
    : SETTLED;

  return {
    sources: { notifications, dialogs, tickets: saas ? tickets : null, decisions },
    requests: requestsStatus,
    tickets: ticketsStatus,
    ticketsEnabled: saas,
    techRequiredStatusId: laneId,
  };
}
