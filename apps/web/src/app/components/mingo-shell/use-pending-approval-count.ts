'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMingoChat } from '@/app/(app)/mingo/providers/mingo-chat-provider';
import { ticketService } from '@/app/(app)/tickets/services';
import { useTicketStatusesQuery } from '@/app/(app)/tickets/statuses/hooks/use-ticket-statuses-query';
import {
  APPROVAL_DIALOGS_QUERY_KEY,
  fetchApprovalDialogsCount,
} from '@/app/components/approvals/approval-dialogs-query';
import { techRequiredStatusId } from '@/app/components/approvals/approval-inbox';
import {
  APPROVALS_POLL_MS,
  approvalTicketsQueryKey,
  useApprovalRefreshSignal,
} from '@/app/components/approvals/use-approval-sources';
import { useSubscriptionOpen } from '@/app/components/subscription-lock/subscription-guard';
import { isSaasTenantMode } from '@/lib/app-mode';

/** Under the page's keys, so what refreshes the page's lists refreshes the counts. */
const DIALOGS_COUNT_KEY = [...APPROVAL_DIALOGS_QUERY_KEY, 'count'] as const;
const ticketsCountKey = (laneId: string) => [...approvalTicketsQueryKey(laneId), 'count'] as const;

/**
 * The sidebar's "Needs approval" badge: how many approval requests wait for a decision,
 * counted by the server — the Mingo chats waiting on one plus the Tech Required tickets
 * waiting on one (`filteredCount`), every request belonging to exactly one of them. Two
 * one-row queries, not the page's lists: the badge is mounted for the whole session.
 * A decision on any surface, or a new request, refetches them (`useApprovalRefreshSignal`).
 */
export function usePendingApprovalCount(): number {
  return usePendingApprovalCountState().badge;
}

/** {@link usePendingApprovalCount}, with whether the answer is in. */
export interface PendingApprovalCountState {
  /** The server's count; `null` where it is not counted here (not a SaaS tenant, no chat, locked) or its read failed. */
  count: number | null;
  /** A count is being read for the first time: a reader that must not show a wrong number waits. */
  loading: boolean;
  /** What the badge shows: whatever has been counted so far (0 before any answer). */
  badge: number;
}

/**
 * The count of {@link usePendingApprovalCount} and its state, for a reader that holds its own
 * loading form until the number is in ("Needs you"'s Approval requests quick action): the same
 * queries and keys, so the badge and that reader share one request.
 */
export function usePendingApprovalCountState(): PendingApprovalCountState {
  const queryClient = useQueryClient();
  const subscriptionOpen = useSubscriptionOpen();
  const { enabled: chatEnabled } = useMingoChat();
  const live = subscriptionOpen && chatEnabled && isSaasTenantMode();

  const dialogsCount = useQuery({
    queryKey: DIALOGS_COUNT_KEY,
    queryFn: fetchApprovalDialogsCount,
    enabled: live,
    refetchInterval: APPROVALS_POLL_MS,
  });

  const statusesQuery = useTicketStatusesQuery({ enabled: live });
  const laneId = techRequiredStatusId(statusesQuery.data?.snapshot);
  const ticketsCount = useQuery({
    queryKey: ticketsCountKey(laneId ?? ''),
    queryFn: () => ticketService.countPendingApprovalTickets(laneId ?? ''),
    enabled: live && laneId !== null,
    refetchInterval: APPROVALS_POLL_MS,
  });

  useApprovalRefreshSignal(live, () => {
    void queryClient.invalidateQueries({ queryKey: DIALOGS_COUNT_KEY }, { cancelRefetch: false });
    if (laneId) void queryClient.invalidateQueries({ queryKey: ticketsCountKey(laneId) }, { cancelRefetch: false });
  });

  const badge = (dialogsCount.data ?? 0) + (laneId ? (ticketsCount.data ?? 0) : 0);
  if (!live) return { count: null, loading: false, badge };
  // A tenant with no Tech Required lane has no tickets to count (the query never runs).
  const ticketsAnswered = laneId === null ? !statusesQuery.isPending : !ticketsCount.isPending;
  const loading = dialogsCount.isPending || statusesQuery.isPending || !ticketsAnswered;
  const failed = dialogsCount.isError || statusesQuery.isError || (laneId !== null && ticketsCount.isError);
  return { count: loading || failed ? null : badge, loading, badge };
}
