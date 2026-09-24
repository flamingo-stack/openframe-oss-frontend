'use client';

import type { ReactNode } from 'react';
import { type GraphQLTaggedNode, useLazyLoadQuery } from 'react-relay';
import type { OperationType } from 'relay-runtime';
import { useRetryKey } from './content-error-boundary';

interface QueryIslandProps<TQuery extends OperationType> {
  query: GraphQLTaggedNode;
  variables: TQuery['variables'];
  fetchPolicy?: 'store-and-network' | 'store-or-network';
  children: (data: TQuery['response']) => ReactNode;
}

/**
 * One reader of a query that several separately-suspending parts of a page
 * share. The page defines the query (spreading each part's fragment) and wraps
 * every part in its own `<Suspense>` + `QueryIsland`; the parts ask with the
 * same variables, so Relay dedupes them into a single request, and each one
 * paints as soon as it resolves while the data-free chrome between them paints
 * at once.
 *
 * Takes the query as a value so the parts never import the page's module, which
 * imports them.
 */
export function QueryIsland<TQuery extends OperationType>({
  query,
  variables,
  fetchPolicy = 'store-and-network',
  children,
}: QueryIslandProps<TQuery>) {
  const retryKey = useRetryKey();
  const data = useLazyLoadQuery<TQuery>(query, variables, { fetchPolicy, fetchKey: retryKey });
  return children(data);
}
