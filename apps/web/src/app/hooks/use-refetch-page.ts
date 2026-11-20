'use client';

import { useCallback } from 'react';
import { fetchQuery, type GraphQLTaggedNode, useRelayEnvironment } from 'react-relay';
import type { OperationType } from 'relay-runtime';

/**
 * Refetch the page a paged table shows, with the same variables, from the network. The store update re-renders the
 * table from its `useLazyLoadQuery`, so nothing suspends or dims: this is what a mutation, a NATS event or an
 * auto-refresh tick calls instead of editing a connection in place (a paged query has no `@connection` to edit).
 *
 * Resolves when the answer is in the store, rejects on its error, so a caller can keep one request in flight.
 */
export function useRefetchPage<TQuery extends OperationType>(
  query: GraphQLTaggedNode,
  variables: TQuery['variables'],
): () => Promise<void> {
  const environment = useRelayEnvironment();
  return useCallback(
    () =>
      fetchQuery<TQuery>(environment, query, variables, { fetchPolicy: 'network-only' })
        .toPromise()
        .then(() => undefined),
    [environment, query, variables],
  );
}
