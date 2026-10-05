'use client';

import { useQuery } from '@tanstack/react-query';
import type { Tag } from '@/app/components/shared/tags';
import { apiClient } from '@/lib/api-client';
import { API_ENDPOINTS } from '../constants';
import { GET_TICKET_TAGS_QUERY } from '../queries/ticket-queries';
import type { GraphQlResponse } from '../utils/graphql';
import { extractGraphQlData } from '../utils/graphql';
import { ticketsQueryKeys } from '../utils/query-keys';

export function useTicketTags() {
  return useQuery({
    queryKey: ticketsQueryKeys.tags(),
    queryFn: async (): Promise<Tag[]> => {
      const response = await apiClient.post<GraphQlResponse<{ ticketTags: Tag[] }>>(API_ENDPOINTS.GRAPHQL, {
        query: GET_TICKET_TAGS_QUERY,
      });
      const data = extractGraphQlData(response);
      return data.ticketTags ?? [];
    },
  });
}
