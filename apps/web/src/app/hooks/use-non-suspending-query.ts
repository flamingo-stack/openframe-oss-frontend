'use client';

import { useEffect, useState } from 'react';
import { fetchQuery, type GraphQLTaggedNode, useLazyLoadQuery, useRelayEnvironment } from 'react-relay';
import { createOperationDescriptor, getRequest, type OperationType } from 'relay-runtime';

/**
 * A read that never suspends and never throws — Relay's recipe for fetching
 * without Suspense: `fetchQuery`, then read the answer `store-only`.
 *
 * For reads a surface cannot put behind a boundary of its own: a picker's options
 * and a "deleted" mark feed lib components that take plain props, from inside
 * board cards, table cells and modals. Until a request's answer lands the previous
 * answer stays on screen; a failed request keeps it too and only ends `isLoading`
 * (the next change of variables asks again).
 *
 * The query declares `$list: Boolean!` and guards its root fields with
 * `@include(if: $list)`: before the first answer it is read with `list: false`,
 * which reads nothing and needs no request. Pass the variables with `list: true`.
 */
export function useNonSuspendingQuery<TQuery extends OperationType>(
  query: GraphQLTaggedNode,
  variables: TQuery['variables'],
  enabled = true,
) {
  const environment = useRelayEnvironment();
  // A string, not an object: the effect and the answer compare it by value.
  const requestKey = enabled ? JSON.stringify(variables) : null;
  const [answeredKey, setAnsweredKey] = useState<string | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);

  useEffect(() => {
    if (requestKey === null) return undefined;
    const operation = createOperationDescriptor(getRequest(query), JSON.parse(requestKey));
    // Held while it is asked for: the answer survives a GC until it is read, and
    // the store records when it was fetched, so it expires like any other query.
    const retained = environment.retain(operation);
    let current = true;
    // Not unsubscribed on cleanup: an identical request in flight is shared, so
    // a remount (or another card asking the same) joins it instead of sending
    // its own. A stale answer is only ignored.
    fetchQuery<TQuery>(environment, query, operation.request.variables, {
      // Answered already: read from the store.
      fetchPolicy: 'store-or-network',
    }).subscribe({
      complete: () => current && setAnsweredKey(requestKey),
      error: () => current && setFailedKey(requestKey),
    });
    return () => {
      current = false;
      retained.dispose();
    };
  }, [environment, query, requestKey]);

  const data = useLazyLoadQuery<TQuery>(
    query,
    answeredKey === null ? { ...variables, list: false } : JSON.parse(answeredKey),
    { fetchPolicy: 'store-only' },
  );

  return {
    data,
    isLoading: requestKey !== null && requestKey !== answeredKey && requestKey !== failedKey,
  };
}
