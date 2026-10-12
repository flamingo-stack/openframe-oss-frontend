'use client';

import { useDeferredValue } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { useUserStatusMapQuery } from '@/__generated__/useUserStatusMapQuery.graphql';
import { isDeletedUserStatus } from '@/app/components/shared/deleted-user';
import { rawIdOf, toGlobalId } from '@/lib/relay-id';

/**
 * `@include(if: $list)` is off until there are ids, and for the first render: read
 * `store-only`, that draws the surface without a request, and the statuses arrive
 * in the deferred re-render.
 */
const userStatusMapQuery = graphql`
  query useUserStatusMapQuery($ids: [ID!]!, $list: Boolean!) {
    nodes(ids: $ids) @include(if: $list) {
      __typename
      ... on User {
        id
        status
      }
    }
  }
`;

/** The deferred ids' first-render value: nothing asked yet. */
const NOT_YET = null;

/**
 * Whether the users a surface shows are deleted, for payloads that carry a user id
 * but no status: the tickets domain, where `/chat/graphql` (saas-ai-agent)
 * denormalizes the assignee to an id + name snapshot.
 *
 * Asks `nodes(ids:)` for exactly the ids passed — the distinct users on screen.
 * The ids are deferred, so it never suspends the surface: until the answer for a
 * new id lands, the previous answer stays and the new id reads as not deleted.
 *
 * Lookup accepts both raw ids and Relay global ids. Deliberately fail-open: an id
 * the API does not know (a REMOVED, purged user, who arrives already anonymized)
 * answers "not deleted".
 */
export function useUserStatusMap(userIds: readonly (string | null | undefined)[]) {
  const key = [...new Set(userIds.filter((id): id is string => !!id).map(rawIdOf))].sort().join(',');
  const deferred = useDeferredValue<string | null>(key, NOT_YET);
  const ids = deferred ? deferred.split(',').map(id => toGlobalId('User', id)) : [];

  const data = useLazyLoadQuery<useUserStatusMapQuery>(
    userStatusMapQuery,
    { ids, list: ids.length > 0 },
    { fetchPolicy: ids.length > 0 ? 'store-or-network' : 'store-only' },
  );

  const statusById = new Map<string, string>();
  for (const node of data.nodes ?? []) {
    if (node?.__typename === 'User' && node.status) statusById.set(rawIdOf(node.id), node.status);
  }

  const isUserDeleted = (id?: string | null): boolean => !!id && isDeletedUserStatus(statusById.get(rawIdOf(id)));

  return { isUserDeleted };
}
