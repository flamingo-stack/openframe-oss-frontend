'use client';

import { graphql } from 'react-relay';
import type { useUsersByIdQuery } from '@/__generated__/useUsersByIdQuery.graphql';
import { toUserSummary, type UserSummary } from '@/graphql/users/user-summary-fields';
import { rawIdOf, toGlobalId } from '@/lib/relay-id';
import { useNonSuspendingQuery } from './use-non-suspending-query';

const usersByIdQuery = graphql`
  query useUsersByIdQuery($ids: [ID!]!, $list: Boolean!) {
    nodes(ids: $ids) @include(if: $list) {
      __typename
      ... on User {
        ...userSummaryFields_user
      }
    }
  }
`;

/**
 * The users behind a list of ids, for payloads that carry a user id and nothing
 * else: the tickets domain, where `/chat/graphql` (saas-ai-agent) keeps the
 * assignee as an id + name snapshot. Ids may be raw or Relay global; the map is
 * keyed by the raw id.
 *
 * Never suspends or throws (see useNonSuspendingQuery): until the answer for a new
 * id lands, that id is absent. So is an id the API does not know — a purged user,
 * who arrives already anonymized.
 */
export function useUsersById(userIds: readonly (string | null | undefined)[]) {
  const ids = [...new Set(userIds.filter((id): id is string => !!id).map(rawIdOf))].sort();
  const { data, isLoading } = useNonSuspendingQuery<useUsersByIdQuery>(
    usersByIdQuery,
    { ids: ids.map(id => toGlobalId('User', id)), list: true },
    ids.length > 0,
  );

  const users = new Map<string, UserSummary>();
  for (const node of data.nodes ?? []) {
    if (node?.__typename === 'User') {
      const user = toUserSummary(node);
      users.set(user.rawId, user);
    }
  }

  return { users, isLoading };
}
