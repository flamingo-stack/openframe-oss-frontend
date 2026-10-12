'use client';

import { useEffect, useState } from 'react';
import { fetchQuery, graphql, useRelayEnvironment } from 'react-relay';
import type { useUserStatusMapQuery } from '@/__generated__/useUserStatusMapQuery.graphql';
import { isDeletedUserStatus } from '@/app/components/shared/deleted-user';
import { rawIdOf, toGlobalId } from '@/lib/relay-id';

const userStatusMapQuery = graphql`
  query useUserStatusMapQuery($ids: [ID!]!) {
    nodes(ids: $ids) {
      __typename
      ... on User {
        id
        status
      }
    }
  }
`;

const EMPTY_STATUS_MAP = new Map<string, string>();

/**
 * Whether the users a surface shows are deleted, for payloads that carry a user id
 * but no status: the tickets domain, where `/chat/graphql` (saas-ai-agent)
 * denormalizes the assignee to an id + name snapshot.
 *
 * Asks `nodes(ids:)` for exactly the ids passed — the distinct users on screen —
 * and refetches when that set changes. It does not suspend: the mark is
 * decorative, and a Suspense boundary would blank a board for it. Until the
 * answer for a new id lands, the previous answer stays and the new id reads as
 * not deleted.
 *
 * Lookup accepts both raw ids and Relay global ids. Deliberately fail-open: an id
 * the API does not know (a REMOVED, purged user, who arrives already anonymized),
 * or a failed read, answers "not deleted" — no toast, the feature is decorative.
 */
export function useUserStatusMap(userIds: readonly (string | null | undefined)[]) {
  const environment = useRelayEnvironment();
  const key = [...new Set(userIds.filter((id): id is string => !!id).map(rawIdOf))].sort().join(',');
  const [statusById, setStatusById] = useState(EMPTY_STATUS_MAP);

  useEffect(() => {
    if (!key) return undefined;
    const ids = key.split(',').map(id => toGlobalId('User', id));
    const subscription = fetchQuery<useUserStatusMapQuery>(
      environment,
      userStatusMapQuery,
      { ids },
      { fetchPolicy: 'store-or-network' },
    ).subscribe({
      next: data => {
        const next = new Map<string, string>();
        for (const node of data.nodes) {
          if (node?.__typename === 'User' && node.status) next.set(rawIdOf(node.id), node.status);
        }
        setStatusById(next);
      },
      error: () => {},
    });
    return () => subscription.unsubscribe();
  }, [environment, key]);

  const isUserDeleted = (id?: string | null): boolean => !!id && isDeletedUserStatus(statusById.get(rawIdOf(id)));

  return { isUserDeleted };
}
