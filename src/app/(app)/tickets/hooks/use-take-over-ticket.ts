'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { EVENT_SUBTYPE, trackDashboardActivity } from '@/lib/analytics';
import { apiClient } from '@/lib/api-client';
import { API_ENDPOINTS } from '../constants';
import { TAKE_OVER_TICKET_MUTATION } from '../queries/ticket-queries';
import type { TicketPayload } from '../types/ticket.types';
import type { GraphQlResponse } from '../utils/graphql';
import { extractGraphQlData } from '../utils/graphql';
import { dialogsQueryKeys, ticketsQueryKeys } from '../utils/query-keys';
import { useMutation } from '@tanstack/react-query';

export interface TakeOverTicketInput {
  ticketId: string;
  toStatusId: string;
  assigneeId: string;
}

/**
 * Take Over a ticket from the AI assistant: the atomic `takeOverTicket`
 * mutation moves the ticket to the selected status, assigns the technician,
 * and switches the client dialog to DIRECT mode (creating one when the ticket
 * has none) in a single backend transaction — all-or-nothing.
 *
 * NOTE: This still goes through the legacy REST-tunneled GraphQL endpoint
 * (`apiClient.post` against `API_ENDPOINTS.GRAPHQL`) rather than react-relay.
 * Migrating this hook to react-relay requires generating the corresponding
 * Relay mutation artifacts (via the Relay compiler) from a `.graphql`
 * mutation definition, which is outside the scope of a same-file fix and
 * cannot be safely fabricated here without those generated artifacts
 * existing in the repository. This is flagged as a follow-up migration.
 */
export function useTakeOverTicket() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: TakeOverTicketInput) => {
      const response = await apiClient.post<GraphQlResponse<{ takeOverTicket: TicketPayload }>>(API_ENDPOINTS.GRAPHQL, {
        query: TAKE_OVER_TICKET_MUTATION,
        variables: { input },
      });

      const payload = extractGraphQlData(response).takeOverTicket;
      if (payload.userErrors?.length) {
        throw new Error(payload.userErrors[0].message);
      }
      return payload.ticket;
    },
    onSuccess: () => {
      trackDashboardActivity(EVENT_SUBTYPE.START_DIRECT_CHAT);
      toast({
        title: 'Ticket taken over',
        description: 'The AI assistant was stopped and a direct chat with the user has started.',
        variant: 'success',
      });
    },
    onError: err => {
      toast({
        title: 'Take Over Failed',
        description: err instanceof Error ? err.message : 'Failed to take over the ticket',
        variant: 'destructive',
        duration: 5000,
      });
    },
    onSettled: (_data, _err, { ticketId }) => {
      queryClient.invalidateQueries({ queryKey: ticketsQueryKeys.detail(ticketId) });
      queryClient.invalidateQueries({ queryKey: ticketsQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: dialogsQueryKeys.all });
    },
  });
}
