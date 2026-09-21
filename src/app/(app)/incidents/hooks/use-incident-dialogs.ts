'use client';

import { keepPreviousData, queryOptions, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { GET_MINGO_DIALOGS_QUERY } from '../../mingo/queries/dialogs-queries';
import type { DialogNode, DialogsResponse } from '../../mingo/types';

/**
 * The latest Mingo chat started from an incident, or null — "Fix with Mingo"
 * links the dialog it creates to the insight, and the Mingo button offers to
 * reopen it instead of starting another. `/chat/graphql` is the ai-agent (raw
 * POST by design, see the Data Fetching Strategy).
 *
 * A failed lookup answers null rather than throwing: the button then offers a
 * fresh chat, which is the right fallback, and the header must not fall over
 * because the chat service did. Keyed under `mingo-dialogs`: the drawer
 * invalidates that on every dialog it creates, which is exactly when this
 * answer changes.
 */
function latestIncidentDialogQuery(insightId: string) {
  return queryOptions({
    queryKey: ['mingo-dialogs', 'insight', insightId],
    queryFn: async (): Promise<DialogNode | null> => {
      const response = await apiClient.post<DialogsResponse>('/chat/graphql', {
        query: GET_MINGO_DIALOGS_QUERY,
        variables: { filter: { agentTypes: ['ADMIN'], insightId }, pagination: { limit: 1 } },
      });
      if (!response.ok || !response.data) {
        console.warn('[incidents] Mingo session lookup failed:', response.error);
        return null;
      }
      return response.data.data.dialogs.edges[0]?.node ?? null;
    },
    staleTime: 30 * 1000,
  });
}

/** The detail header's answer. Suspends, so the header renders once with the right button — no spinner, no relabel. */
export function useLatestIncidentDialog(insightId: string): DialogNode | null {
  return useSuspenseQuery(latestIncidentDialogQuery(insightId)).data;
}

/**
 * Pending while `undefined`. The API filters by a single `insightId`, so this
 * is one request per row — but ONE query for the table, keyed on the id set,
 * whose function fans out through `fetchQuery` so each per-incident answer
 * lands in the same cache entry the detail header reads. Per-row `useQueries`
 * was tried: a fresh query list and combine per render churned the observer,
 * and the table's rows need a stable answer object. `keepPreviousData` keeps
 * the known rows answered while a scrolled-in page adds ids.
 */
export type IncidentDialogLookup = Readonly<Record<string, DialogNode | null | undefined>>;

const NO_LOOKUP: IncidentDialogLookup = {};

export function useLatestIncidentDialogs(insightIds: readonly string[]): IncidentDialogLookup {
  const queryClient = useQueryClient();
  const ids = [...insightIds].sort();
  const query = useQuery({
    queryKey: ['mingo-dialogs', 'insights', ids],
    queryFn: async (): Promise<IncidentDialogLookup> => {
      const entries = await Promise.all(
        ids.map(async id => [id, await queryClient.fetchQuery(latestIncidentDialogQuery(id))] as const),
      );
      return Object.fromEntries(entries);
    },
    enabled: ids.length > 0,
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
  });
  return query.data ?? NO_LOOKUP;
}
