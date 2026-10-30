'use client';

import { useOptionalNotifications } from '@flamingo-stack/openframe-frontend-core/components/features';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useMingoChat } from '@/app/(app)/mingo/providers/mingo-chat-provider';
import { ticketService } from '@/app/(app)/tickets/services';
import { useTicketStatusesQuery } from '@/app/(app)/tickets/statuses/hooks/use-ticket-statuses-query';
import { dialogsQueryKeys } from '@/app/(app)/tickets/utils/query-keys';
import { useSubscriptionOpen } from '@/app/components/subscription-lock/subscription-guard';
import { fetchApprovalNotifications } from '@/graphql/notifications/approval-notifications-relay';
import { isSaasTenantMode } from '@/lib/app-mode';
import { loadErrorProps, queryState } from '@/lib/query-state';
import { useApprovalDecisions } from './approval-decisions';
import { APPROVAL_DIALOGS_QUERY_KEY, fetchApprovalDialogs } from './approval-dialogs-query';
import { type ApprovalSources, techRequiredStatusId } from './approval-inbox';

/** As often as the chat list re-reads itself; a live event refreshes sooner (below). */
export const APPROVALS_POLL_MS = 60_000;

/** The viewer's unread approval notifications, every page (`approval-notifications-relay.ts`). */
export const APPROVAL_NOTIFICATIONS_QUERY_KEY = ['approvals', 'notifications'] as const;

/**
 * The Tech Required tickets waiting on an approval. Under the tickets' `['dialogs']` prefix,
 * so what refreshes the tickets refreshes these, but not under the board's columns: the
 * board's optimistic writers match those keys, and these pages are another list.
 */
export const approvalTicketsQueryKey = (laneId: string) => [...dialogsQueryKeys.all, 'approvals', laneId] as const;

export const APPROVAL_TICKETS_PAGE_SIZE = 20;

export interface SourceStatus {
  /** First load in flight: draw the list's placeholders. */
  isLoading: boolean;
  /** Nothing loaded and the load failed (or the link is down): the list's strip. */
  error: { message: string; onRetry?: () => void } | null;
  /** Answered with data, so an empty list is really empty — of what is loaded (`hasMore`). */
  canClaimEmpty: boolean;
  /** Rows of the source loaded so far: what an empty list has looked through while `hasMore`. */
  loaded: number;
  hasMore: boolean;
  isLoadingMore: boolean;
  loadMore: () => void;
}

export interface ApprovalSourcesResult {
  sources: ApprovalSources;
  /** The paged sources (notifications, waiting chats, the Tech Required lane) as the one list reads them. */
  status: SourceStatus;
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

/** Paged sources as one list: loading until all answer, more while any has more. */
function combined(...statuses: SourceStatus[]): SourceStatus {
  return {
    isLoading: statuses.some(status => status.isLoading),
    error: statuses.find(status => status.error)?.error ?? null,
    canClaimEmpty: statuses.every(status => status.canClaimEmpty),
    loaded: statuses.reduce((sum, status) => sum + status.loaded, 0),
    hasMore: statuses.some(status => status.hasMore),
    isLoadingMore: statuses.some(status => status.isLoadingMore),
    loadMore: () => {
      for (const status of statuses) if (status.hasMore) status.loadMore();
    },
  };
}

const NO_ROWS: never[] = [];

/**
 * Calls `onChange` when something the approval queries cannot see moves: the drawer's
 * pending approval notifications (a new request, or one resolved elsewhere), the chat
 * list's live "waiting for approval" rows (the open chat's comes from its stream, and a
 * chat on screen gets no notification), a decision made on any surface. Not on the first
 * render — the queries are loading anyway. The Needs approval page and the sidebar badge.
 */
export function useApprovalRefreshSignal(enabled: boolean, onChange: () => void): void {
  const { chat } = useMingoChat();
  const notifications = useOptionalNotifications()?.notifications ?? NO_ROWS;
  const decisions = useApprovalDecisions();

  const liveApprovalChats = (chat?.state.dialogs ?? NO_ROWS)
    .filter(dialog => chat?.dialogStatusOf(dialog) === 'approval')
    .map(dialog => `chat:${dialog.id}`);
  const pendingNotifications = notifications
    .filter(notification => !notification.read && typeof notification.meta?.approvalRequestId === 'string')
    .map(notification => `request:${String(notification.meta?.approvalRequestId)}`);
  const decided = Object.keys(decisions).map(id => `decided:${id}`);
  const signal = [...pendingNotifications, ...liveApprovalChats, ...decided].sort().join(',');

  const lastSignal = useRef<string | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  useEffect(() => {
    const previous = lastSignal.current;
    lastSignal.current = signal;
    if (previous === null || previous === signal || !enabled) return;
    onChangeRef.current();
  }, [signal, enabled]);
}

/**
 * The data behind the Needs approval page, each source filtered on the server:
 * - the viewer's unread approval request notifications (`types`), every page;
 * - the Mingo chats waiting on an approval (`hasPendingApproval`), every admin's;
 * - the Tech Required tickets waiting on one (`hasPendingApproval`), after the ticket
 *   statuses the board also caches.
 *
 * The queries poll at the chat list's pace while the page is mounted and refetch at once
 * on `useApprovalRefreshSignal`; `cancelRefetch: false` folds the page's and the badge's
 * identical reactions into one request. Nothing runs behind the subscription lock, before
 * the chat session is up, or — for the chat service's data — outside SaaS.
 */
export function useApprovalSources(): ApprovalSourcesResult {
  const queryClient = useQueryClient();
  const subscriptionOpen = useSubscriptionOpen();
  const { chat, enabled: chatEnabled } = useMingoChat();
  const saas = isSaasTenantMode();
  const live = subscriptionOpen && chatEnabled;
  const decisions = useApprovalDecisions();

  const notificationsQuery = useInfiniteQuery({
    queryKey: APPROVAL_NOTIFICATIONS_QUERY_KEY,
    queryFn: ({ pageParam }) => fetchApprovalNotifications(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: lastPage =>
      lastPage.pageInfo.hasNextPage ? (lastPage.pageInfo.endCursor ?? undefined) : undefined,
    enabled: subscriptionOpen,
    refetchInterval: APPROVALS_POLL_MS,
  });

  const dialogsQuery = useInfiniteQuery({
    queryKey: APPROVAL_DIALOGS_QUERY_KEY,
    queryFn: ({ pageParam }) => fetchApprovalDialogs(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: lastPage =>
      lastPage.pageInfo.hasNextPage ? (lastPage.pageInfo.endCursor ?? undefined) : undefined,
    enabled: live && saas,
    refetchInterval: APPROVALS_POLL_MS,
  });

  const statusesQuery = useTicketStatusesQuery({ enabled: live && saas });
  const laneId = techRequiredStatusId(statusesQuery.data?.snapshot);
  const ticketsQuery = useInfiniteQuery({
    queryKey: approvalTicketsQueryKey(laneId ?? ''),
    queryFn: ({ pageParam }) =>
      ticketService.fetchPendingApprovalTickets({
        statusId: laneId ?? '',
        cursor: pageParam,
        limit: APPROVAL_TICKETS_PAGE_SIZE,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: lastPage =>
      lastPage.pageInfo.hasNextPage ? (lastPage.pageInfo.endCursor ?? undefined) : undefined,
    enabled: live && saas && laneId !== null,
    refetchInterval: APPROVALS_POLL_MS,
  });

  useApprovalRefreshSignal(subscriptionOpen, () => {
    void queryClient.invalidateQueries({ queryKey: APPROVAL_NOTIFICATIONS_QUERY_KEY }, { cancelRefetch: false });
    if (!live || !saas) return;
    void queryClient.invalidateQueries({ queryKey: APPROVAL_DIALOGS_QUERY_KEY }, { cancelRefetch: false });
    if (laneId) {
      void queryClient.invalidateQueries({ queryKey: approvalTicketsQueryKey(laneId) }, { cancelRefetch: false });
    }
  });

  const notificationsState = queryState(notificationsQuery, 'open');
  const dialogsState = queryState(dialogsQuery, saas ? 'open' : 'closed');
  const statusesState = queryState(statusesQuery, saas ? 'open' : 'closed');
  const ticketsState = queryState(ticketsQuery, saas ? 'open' : 'closed');

  const notifications = notificationsQuery.data?.pages.flatMap(page => page.notifications) ?? NO_ROWS;
  const dialogs = dialogsQuery.data?.pages.flatMap(page => page.dialogs) ?? NO_ROWS;
  const tickets = ticketsQuery.data?.pages.flatMap(page => page.dialogs) ?? NO_ROWS;

  const notificationsStatus: SourceStatus = {
    isLoading: notificationsState.isLoading,
    error:
      notificationsState.error || notificationsState.isOffline
        ? loadErrorProps(
            notificationsState.isOffline,
            "Couldn't load the approval notifications.",
            () => void notificationsQuery.refetch(),
          )
        : null,
    canClaimEmpty: notificationsState.canClaimEmpty,
    loaded: notifications.length,
    hasMore: notificationsQuery.hasNextPage,
    isLoadingMore: notificationsQuery.isFetchingNextPage,
    loadMore: () => void notificationsQuery.fetchNextPage(),
  };

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
        // The tickets query waits for the statuses; with no lane to read it never runs.
        isLoading: statusesState.isLoading || (laneId !== null && ticketsState.isLoading),
        error:
          statusesFailed || ticketsState.error || ticketsState.isOffline
            ? loadErrorProps(
                statusesState.isOffline || ticketsState.isOffline,
                "Couldn't load the tickets waiting for a technician.",
                () => void (statusesFailed ? statusesQuery.refetch() : ticketsQuery.refetch()),
              )
            : null,
        canClaimEmpty: noLane || ticketsState.canClaimEmpty,
        loaded: tickets.length,
        hasMore: ticketsQuery.hasNextPage,
        isLoadingMore: ticketsQuery.isFetchingNextPage,
        loadMore: () => void ticketsQuery.fetchNextPage(),
      }
    : SETTLED;

  const chatTitles = Object.fromEntries(
    (chat?.state.dialogs ?? NO_ROWS).flatMap(dialog => (dialog.title ? [[dialog.id, dialog.title]] : [])),
  );

  return {
    sources: { notifications, dialogs, tickets: saas ? tickets : null, decisions, chatTitles },
    status: combined(notificationsStatus, requestsStatus, ticketsStatus),
    techRequiredStatusId: laneId,
  };
}
