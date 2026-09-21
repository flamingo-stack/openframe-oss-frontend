'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { GET_MINGO_DIALOGS_QUERY } from '../../mingo/queries/dialogs-queries';
import type { DialogNode, DialogsResponse } from '../../mingo/types';

/**
 * The latest Mingo chat started from this incident, or null — "Fix with Mingo"
 * links the dialog it creates to the insight, and the header offers to reopen
 * it instead of starting another. `/chat/graphql` is the ai-agent (raw POST by
 * design, see the Data Fetching Strategy). A failed lookup is not surfaced: the
 * header then simply offers a fresh chat, which is the right fallback.
 */
export function useLatestIncidentDialog(insightId: string): { dialog: DialogNode | null; isLoading: boolean } {
  const query = useQuery({
    // Under the `mingo-dialogs` prefix: the drawer invalidates that on every
    // dialog it creates, which is exactly when this answer changes.
    queryKey: ['mingo-dialogs', 'insight', insightId],
    queryFn: async (): Promise<DialogNode | null> => {
      const response = await apiClient.post<DialogsResponse>('/chat/graphql', {
        query: GET_MINGO_DIALOGS_QUERY,
        variables: { filter: { agentTypes: ['ADMIN'], insightId }, pagination: { limit: 1 } },
      });
      if (!response.ok || !response.data) {
        throw new Error(response.error || 'Failed to look up the Mingo session');
      }
      return response.data.data.dialogs.edges[0]?.node ?? null;
    },
    staleTime: 30 * 1000,
  });
  return { dialog: query.data ?? null, isLoading: query.isLoading };
}
