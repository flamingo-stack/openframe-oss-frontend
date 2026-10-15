'use client';

import { fetchQuery, graphql, useRelayEnvironment, useSubscribeToInvalidationState } from 'react-relay';
import type { useEmployeesTabCountsQuery } from '@/__generated__/useEmployeesTabCountsQuery.graphql';
import { useNonSuspendingQuery } from '@/app/hooks/use-non-suspending-query';

/**
 * How many users and invitations match the search, for the Employees tab bar —
 * the funnels left out: they narrow the open tab's table, and its own count says
 * by how much. The number on the other tab is what tells someone searching for a
 * colleague that the colleague is still an invitation.
 */
const employeesTabCountsQuery = graphql`
  query useEmployeesTabCountsQuery($search: String, $list: Boolean!) {
    users(search: $search, first: 1) @include(if: $list) {
      filteredCount
    }
    invitations(search: $search, first: 1) @include(if: $list) {
      # Revoking an invitation counts it down here too; inviting marks it stale (invitations-listing.ts).
      __id
      filteredCount
    }
  }
`;

export interface EmployeesTabCounts {
  /** Undefined until the first answer, and after a failed one: the tab shows no number. */
  users?: number;
  invitations?: number;
  /** The record behind the invitations count, for the mutations that move it. */
  invitationsCountIds: readonly string[];
}

/** Never suspends or throws: the tab bar draws without numbers until, or unless, they arrive. */
export function useEmployeesTabCounts(search: string): EmployeesTabCounts {
  const environment = useRelayEnvironment();
  const variables = { search: search || null, list: true };
  // network-only: a search typed again must not show the count from before a revoke.
  const { data } = useNonSuspendingQuery<useEmployeesTabCountsQuery>(
    employeesTabCountsQuery,
    variables,
    true,
    'network-only',
  );
  const invitationsCountIds = data.invitations ? [data.invitations.__id] : [];

  useSubscribeToInvalidationState(invitationsCountIds, () => {
    fetchQuery(environment, employeesTabCountsQuery, variables, { fetchPolicy: 'network-only' })
      // The tab keeps the number it has; the next change asks again.
      .subscribe({ error: () => {} });
  });

  return {
    users: data.users?.filteredCount,
    invitations: data.invitations?.filteredCount,
    invitationsCountIds,
  };
}
