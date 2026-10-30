import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import { create } from 'zustand';
import type { MingoDialogsPage } from '@/app/(app)/mingo/utils/dialog-row-status';
import { mingoDialogQueryKeys } from '@/app/(app)/mingo/utils/query-keys';
import type { TicketsPage } from '@/app/(app)/tickets/services/ticket-service.types';
import { dialogsQueryKeys, ticketsQueryKeys } from '@/app/(app)/tickets/utils/query-keys';

/**
 * The approval decisions this tab has made, by approval request id.
 *
 * Every surface decides through the one mutation (`ticketService.resolveApprovalRequest`:
 * the notification drawer, the notifications history, the Mingo chat, the tickets board,
 * the Needs approval page), and that mutation records its outcome here. So the Needs
 * approval page and its sidebar badge drop a request the moment any surface settles it,
 * without waiting for their own sources (the drawer list, the chat list, the board lane)
 * to catch up: a notification's resolution push, a poll.
 *
 * Kept free of React and of the query client on purpose: the service that writes it is
 * imported everywhere, and must not drag either along.
 */

export type ApprovalDecision = 'approved' | 'rejected';

interface ApprovalDecisionsState {
  decisions: Readonly<Record<string, ApprovalDecision>>;
}

export const useApprovalDecisionsStore = create<ApprovalDecisionsState>()(() => ({ decisions: {} }));

/** Record a settled request. Called by the mutation itself, after the server accepted it. */
export function noteApprovalDecision(approvalRequestId: string, approved: boolean): void {
  const decision: ApprovalDecision = approved ? 'approved' : 'rejected';
  useApprovalDecisionsStore.setState(state =>
    state.decisions[approvalRequestId] === decision
      ? state
      : { decisions: { ...state.decisions, [approvalRequestId]: decision } },
  );
}

/** Every decision made in this tab, live. */
export function useApprovalDecisions(): Readonly<Record<string, ApprovalDecision>> {
  return useApprovalDecisionsStore(state => state.decisions);
}

/** Tests only: forget every decision. */
export function clearApprovalDecisions(): void {
  useApprovalDecisionsStore.setState({ decisions: {} });
}

/**
 * Write a decision into the caches the other surfaces draw from, as their own decision
 * paths do:
 * - the tickets board: the lane card drops its approval block (the board's own decision
 *   does exactly this) and the ticket's detail refetches — its status lock releases;
 * - the Mingo chat list: the row loses its "waiting for approval" glyph until the next
 *   poll says otherwise.
 *
 * Matched by the approval request id, so it needs neither the ticket nor the chat. A
 * cache that does not hold the request comes back by reference.
 */
export function settleApprovalCaches(queryClient: QueryClient, approvalRequestId: string): void {
  const settledTickets = new Set<string>();
  queryClient.setQueriesData<InfiniteData<TicketsPage>>({ queryKey: dialogsQueryKeys.boardColumns() }, data => {
    if (!data?.pages.some(page => page.dialogs.some(ticket => ticket.pendingApproval?.id === approvalRequestId))) {
      return data;
    }
    return {
      ...data,
      pages: data.pages.map(page => ({
        ...page,
        dialogs: page.dialogs.map(ticket => {
          if (ticket.pendingApproval?.id !== approvalRequestId) return ticket;
          settledTickets.add(ticket.id);
          return { ...ticket, pendingApproval: undefined };
        }),
      })),
    };
  });
  for (const ticketId of settledTickets) {
    void queryClient.invalidateQueries({ queryKey: ticketsQueryKeys.detail(ticketId) });
  }

  queryClient.setQueriesData<InfiniteData<MingoDialogsPage>>({ queryKey: mingoDialogQueryKeys.lists }, data => {
    if (!data?.pages.some(page => page.dialogs.some(dialog => dialog.pendingApproval?.id === approvalRequestId))) {
      return data;
    }
    return {
      ...data,
      pages: data.pages.map(page => ({
        ...page,
        dialogs: page.dialogs.map(dialog =>
          dialog.pendingApproval?.id === approvalRequestId ? { ...dialog, pendingApproval: null } : dialog,
        ),
      })),
    };
  });
}
