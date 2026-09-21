'use client';

import { keepPreviousData, queryOptions, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { ACTIVE_DIALOG_STATUSES } from '../../mingo/hooks/use-mingo-dialogs';
import { GET_MINGO_DIALOGS_QUERY } from '../../mingo/queries/dialogs-queries';
import type { DialogConnection, DialogNode } from '../../mingo/types';
import type { GraphQlResponse } from '../../tickets/utils/graphql';

/** One freshness policy for one answer, whichever query asks. */
const DIALOG_LOOKUP_STALE_MS = 30 * 1000;

/**
 * The latest Mingo chat about an incident, or null — a chat whose first
 * message carries the incident ("Fix with Mingo" attaches it) is listed under
 * it, and the Mingo button offers to reopen that instead of starting another.
 * Only the statuses the drawer can show: an archived chat would leave the
 * button pointing at a conversation the drawer refuses.
 *
 * `/chat/graphql` is the ai-agent (raw POST by design, see the Data Fetching
 * Strategy). Every failure — transport, or a GraphQL error envelope such as an
 * ai-agent that does not know the `insightId` filter yet — answers null
 * without a toast, deliberately: the button then offers a fresh chat, which is
 * the right fallback, and the header must not fall over because the chat
 * service did. Keyed under `mingo-dialogs`: the drawer invalidates that on
 * every dialog it creates, which is exactly when this answer changes.
 */
function latestIncidentDialogQuery(insightId: string) {
  return queryOptions({
    queryKey: ['mingo-dialogs', 'insight', insightId],
    queryFn: async (): Promise<DialogNode | null> => {
      const response = await apiClient.post<GraphQlResponse<{ dialogs: DialogConnection }>>('/chat/graphql', {
        query: GET_MINGO_DIALOGS_QUERY,
        variables: {
          filter: { agentTypes: ['ADMIN'], statuses: ACTIVE_DIALOG_STATUSES, insightId },
          pagination: { limit: 1 },
        },
      });
      const envelope = response.data;
      if (!response.ok || !envelope?.data?.dialogs || envelope.errors?.length) {
        console.warn('[incidents] Mingo session lookup failed:', response.error ?? envelope?.errors);
        return null;
      }
      return envelope.data.dialogs.edges[0]?.node ?? null;
    },
    staleTime: DIALOG_LOOKUP_STALE_MS,
  });
}

/** The detail header's answer. Suspends, so the header renders once with the right button — no spinner, no relabel. */
export function useLatestIncidentDialog(insightId: string): DialogNode | null {
  return useSuspenseQuery(latestIncidentDialogQuery(insightId)).data;
}

/** Per incident: the chat, null for none, undefined while the lookup is pending. */
export type IncidentDialogLookup = Readonly<Record<string, DialogNode | null | undefined>>;

const NO_LOOKUP: IncidentDialogLookup = {};

/**
 * The table's answers. The API filters by a single `insightId`, so this is one
 * request per row — but ONE query for the table, keyed on the id set, whose
 * function fans out through `fetchQuery` so each per-incident answer lands in
 * the cache entry the detail header reads. (Per-row `useQueries` was tried: a
 * fresh query list and combine per render churned the observer, and the rows
 * need a stable answer object.) `keepPreviousData` keeps the known rows
 * answered while a scrolled-in page adds ids. The per-id query never rejects,
 * so one bad row cannot blank the column.
 */
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
    staleTime: DIALOG_LOOKUP_STALE_MS,
    placeholderData: keepPreviousData,
  });
  return query.data ?? NO_LOOKUP;
}
