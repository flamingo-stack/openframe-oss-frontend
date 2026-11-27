'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { API_ENDPOINTS } from '../constants';
import { extractGraphQlData, type GraphQlResponse } from '../utils/graphql';
import { ticketsQueryKeys } from '../utils/query-keys';
import {
  GET_TICKET_ATTACHMENT_SOURCES_QUERY,
  type TicketAttachmentSource,
  type TicketAttachmentSources,
} from './ticket-attachment-sources-query';

/**
 * Where each of a ticket's files came from, by attachment id. `enabled` only while the `mingo-chat-attachments` flag
 * is on. Under the ticket's detail key, so whatever refreshes the ticket (a file added or deleted) refreshes this too.
 */
export function useTicketAttachmentSources(ticketId: string, { enabled }: { enabled: boolean }) {
  return useQuery<ReadonlyMap<string, TicketAttachmentSource>>({
    queryKey: ticketsQueryKeys.attachmentSources(ticketId),
    enabled: enabled && !!ticketId,
    staleTime: 30_000,
    queryFn: async () => {
      const response = await apiClient.post<GraphQlResponse<{ ticket: TicketAttachmentSources | null }>>(
        API_ENDPOINTS.GRAPHQL,
        { query: GET_TICKET_ATTACHMENT_SOURCES_QUERY, variables: { id: ticketId } },
      );
      const attachments = extractGraphQlData(response).ticket?.attachments ?? [];
      return new Map(attachments.map(attachment => [attachment.id, attachment.source]));
    },
  });
}
