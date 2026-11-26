'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { API_ENDPOINTS } from '../constants';
import { extractGraphQlData, type GraphQlResponse } from '../utils/graphql';
import { ticketsQueryKeys } from '../utils/query-keys';
import { GET_TICKET_EMAIL_QUERY, type TicketEmail } from './ticket-email-query';

/**
 * A ticket's email side: its origin, its requester and the replies that can reach them. `enabled` only while the
 * `email-to-ticket` flag is on. Under the ticket's detail key, so whatever refreshes the ticket refreshes this too.
 */
export function useTicketEmail(ticketId: string, { enabled }: { enabled: boolean }) {
  return useQuery<TicketEmail | null>({
    queryKey: ticketsQueryKeys.email(ticketId),
    enabled,
    staleTime: 30_000,
    queryFn: async () => {
      const response = await apiClient.post<GraphQlResponse<{ ticket: TicketEmail | null }>>(API_ENDPOINTS.GRAPHQL, {
        query: GET_TICKET_EMAIL_QUERY,
        variables: { id: ticketId },
      });
      return extractGraphQlData(response).ticket;
    },
  });
}
