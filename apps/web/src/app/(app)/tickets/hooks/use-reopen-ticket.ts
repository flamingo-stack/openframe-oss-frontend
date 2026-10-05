'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { API_ENDPOINTS } from '../constants';
import { ASSIGN_TICKET_MUTATION, UNASSIGN_TICKET_MUTATION } from '../queries/ticket-queries';
import { ticketService } from '../services';
import type { TicketPayload } from '../types/ticket.types';
import type { GraphQlResponse } from '../utils/graphql';
import { extractGraphQlData } from '../utils/graphql';
import { dialogsQueryKeys, invalidateAllDialogs, ticketsQueryKeys } from '../utils/query-keys';

export interface ReopenTicketInput {
  ticketId: string;
  /** Target status the admin picked in the modal. */
  toStatusId: string;
  /** Kind-token of `toStatusId` (from the statuses snapshot). Unused today;
   *  kept so the modal keeps passing it for when the backend grows an
   *  admin reopen verb that wants it. */
  toStatusKind?: string;
  /** Desired assignee; `null` — leave/make the ticket unassigned. */
  assigneeId: string | null;
  /** The ticket's assignee before the modal opened, to diff against. */
  currentAssigneeId: string | null;
  /** Trimmed modal reason; `null` when left blank. See the note on
   *  `reopenTicketApi` — no admin-side wire accepts it yet. */
  reason: string | null;
}

/**
 * Admin reopen (ClickUp 86ajnyctz):
 *
 * 1. `transitionTicket` out of the terminal status. The backend treats a
 *    terminal→open transition as THE admin reopen: it fires the TICKET_EVENT
 *    chat card and the TICKET_REOPENED notification server-side.
 *    `requestTicketReopen` is deliberately NOT called here — it is the
 *    CLIENT-chat verb and the backend rejects admins with "Only the client
 *    can reopen through the chat".
 * 2. Assignment — only when the modal selection differs from the ticket's
 *    previous assignee (the design default restores it).
 *
 * `reason` currently has no admin-side wire: the design's modal collects it,
 * but neither `transitionTicket` nor any admin mutation accepts it yet —
 * raised with BE; plumb it through here once a field exists.
 */
async function reopenTicketApi(input: ReopenTicketInput): Promise<void> {
  const { ticketId, toStatusId, assigneeId, currentAssigneeId } = input;

  await ticketService.transitionTicket(ticketId, toStatusId);

  if (assigneeId !== currentAssigneeId) {
    const isUnassign = assigneeId === null;
    const assignResponse = await apiClient.post<
      GraphQlResponse<{ assignTicket: TicketPayload } & { unassignTicket: TicketPayload }>
    >(API_ENDPOINTS.GRAPHQL, {
      query: isUnassign ? UNASSIGN_TICKET_MUTATION : ASSIGN_TICKET_MUTATION,
      variables: { input: isUnassign ? { id: ticketId } : { id: ticketId, assigneeId } },
    });
    const assignData = extractGraphQlData(assignResponse);
    const assignPayload = isUnassign ? assignData.unassignTicket : assignData.assignTicket;
    if (assignPayload.userErrors?.length) {
      throw new Error(assignPayload.userErrors[0].message);
    }
  }
}

export function useReopenTicket() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: reopenTicketApi,
    onSuccess: (_data, { ticketId }) => {
      queryClient.invalidateQueries({ queryKey: ticketsQueryKeys.detail(ticketId) });
      queryClient.invalidateQueries({ queryKey: dialogsQueryKeys.all });
      invalidateAllDialogs(queryClient);
      toast({ title: 'Ticket reopened', variant: 'success' });
    },
    onError: err => {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to reopen ticket',
        variant: 'destructive',
        duration: 5000,
      });
    },
  });
}
