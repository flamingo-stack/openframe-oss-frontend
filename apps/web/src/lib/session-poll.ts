/**
 * The poll gate for background queries against the tenant gateway: one helper
 * instead of per-file status checks, because the failing request never reaches
 * the query's own options with a status in hand (the data layer folds it into an
 * `Error`) — the session-health state is the signal that survives that.
 *
 * On a polling query: `retry: sessionRetry(n)`, `refetchInterval:
 * sessionInterval(ms)` (or `sessionPollsAllowed()` at the top of an interval
 * callback) and `meta: sessionPollMeta`.
 *
 *   - `retry` never retries once the session is not `healthy`, so a 401 that
 *     survived a refresh (or a 410) is not re-sent `retry` times.
 *   - the interval is `false` while the session is not `healthy`. React Query
 *     does not re-evaluate it on external state, so `resumeSessionPolls`
 *     refetches the queries carrying `sessionPollMeta` when the session comes
 *     back — the refetch is what restarts the interval.
 */

import type { QueryClient } from '@tanstack/react-query';
import { getSessionHealth, useSessionHealthStore } from './session-health';

type RetryOption = number | ((failureCount: number, error: Error) => boolean);

/** Marks a polling query so `resumeSessionPolls` can find it. */
export const sessionPollMeta = { sessionPoll: true } as const;

export function sessionPollsAllowed(): boolean {
  return getSessionHealth() === 'healthy';
}

export function sessionRetry(base: RetryOption): (failureCount: number, error: Error) => boolean {
  return (failureCount, error) => {
    if (!sessionPollsAllowed()) return false;
    return typeof base === 'function' ? base(failureCount, error) : failureCount < base;
  };
}

export function sessionInterval(intervalMs: number): () => number | false {
  return () => (sessionPollsAllowed() ? intervalMs : false);
}

/** Restart the polls the gate stopped. Returns the unsubscribe. */
export function resumeSessionPolls(queryClient: QueryClient): () => void {
  return useSessionHealthStore.subscribe((state, previous) => {
    if (state.health !== 'healthy' || previous.health === 'healthy') return;
    void queryClient.refetchQueries({
      type: 'active',
      predicate: query => query.meta?.sessionPoll === true,
    });
  });
}
