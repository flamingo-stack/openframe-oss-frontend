'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { API_ENDPOINTS } from '../constants';
import {
  ASSIGN_TICKET_MUTATION,
  REQUEST_TICKET_REOPEN_MUTATION,
  UNASSIGN_TICKET_MUTATION,
} from '../queries/ticket-queries';
import { ticketService } from '../services';
import type { TicketPayload } from '../types/ticket.types';
import type { GraphQlResponse } from '../utils/graphql';
import { extractGraphQlData } from '../utils/graphql';
import { dialogsQueryKeys, invalidateAllDialogs, ticketsQueryKeys } from '../utils/query-keys';
import { TICKET_STATUS_KIND } from '../utils/ticket-statistics';

export interface ReopenTicketInput {
  ticketId: string;
  /** Target status the admin picked in the modal. */
  toStatusId: string;
  /** Kind-token of `toStatusId` (from the statuses snapshot) — lets the hook
   *  skip the follow-up transition when the backend already reopened into a
   *  status of the same SYSTEM kind. */
  toStatusKind?: string;
  /** Desired assignee; `null` — leave/make the ticket unassigned. */
  assigneeId: string | null;
  /** The ticket's assignee before the modal opened, to diff against. */
  currentAssigneeId: string | null;
  /** Trimmed modal reason; `null` when left blank. */
  reason: string | null;
}

interface TicketReopenPayload {
  ticketId: string;
  targetStatusKind?: string | null;
  userErrors?: Array<{ field?: string[]; message: string }>;
}

/**
 * Composite admin reopen (documented BE contract, ClickUp 86ajnyctz):
 *
 * 1. `requestTicketReopen` — THE reopen verb. Reopens the ticket into the
 *    backend's default target, records the reason, fires the TICKET_EVENT
 *    chat card and the TICKET_REOPENED notification.
 * 2. `transitionTicket` — only when the admin picked a status the backend
 *    didn't reopen into. Kinds are compared, not ids, because the payload
 *    carries a kind-token; two CUSTOM statuses share a kind, so a CUSTOM
 *    pick always transitions.
 * 3. Assignment — only when the modal selection differs from the ticket's
 *    previous assignee (the design default restores it).
 *
 * The input has no target/assignee fields today; if the backend later folds
 * them into `TicketReopenInput`, steps 2-3 collapse into step 1.
 */
async function reopenTicketApi(input: ReopenTicketInput): Promise<void> {
  const { ticketId, toStatusId, toStatusKind, assigneeId, currentAssigneeId, reason } = input;

  const response = await apiClient.post<GraphQlResponse<{ requestTicketReopen: TicketReopenPayload }>>(
    API_ENDPOINTS.GRAPHQL,
    {
      query: REQUEST_TICKET_REOPEN_MUTATION,
      variables: { input: { id: ticketId, ...(reason ? { reason } : {}) } },
    },
  );
  const payload = extractGraphQlData(response).requestTicketReopen;
  if (payload.userErrors?.length) {
    throw new Error(payload.userErrors[0].message);
  }

  const reopenedIntoPickedKind =
    !!toStatusKind && toStatusKind !== TICKET_STATUS_KIND.CUSTOM && payload.targetStatusKind === toStatusKind;
  if (!reopenedIntoPickedKind) {
    await ticketService.transitionTicket(ticketId, toStatusId);
  }

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
