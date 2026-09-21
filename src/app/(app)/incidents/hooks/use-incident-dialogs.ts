'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { GET_MINGO_DIALOGS_QUERY } from '../../mingo/queries/dialogs-queries';
import type { DialogNode, DialogsResponse } from '../../mingo/types';

const SESSIONS_LIMIT = 20;

/**
 * The Mingo chats started from this incident ("Fix with Mingo" links the dialog
 * it creates to the insight). `/chat/graphql` is the ai-agent — raw POST by
 * design, see the Data Fetching Strategy. Errors throw into the section's
 * boundary rather than hiding a list the user may be looking for.
 */
export function useIncidentDialogs(insightId: string) {
  return useQuery({
    // Under the `mingo-dialogs` prefix: the drawer invalidates that on every
    // dialog it creates, which is exactly when this list changes.
    queryKey: ['mingo-dialogs', 'insight', insightId],
    queryFn: async (): Promise<DialogNode[]> => {
      const response = await apiClient.post<DialogsResponse>('/chat/graphql', {
        query: GET_MINGO_DIALOGS_QUERY,
        variables: { filter: { agentTypes: ['ADMIN'], insightId }, pagination: { limit: SESSIONS_LIMIT } },
      });
      if (!response.ok || !response.data) {
        throw new Error(response.error || 'Failed to load Mingo sessions');
      }
      return response.data.data.dialogs.edges.map(edge => edge.node);
    },
    throwOnError: true,
    staleTime: 30 * 1000,
  });
}
