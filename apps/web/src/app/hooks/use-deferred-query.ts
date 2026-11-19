'use client';

import { useDeferredValue } from 'react';

interface UseDeferredQueryResult<F> {
  /** Filters to feed the query — lags `filters` while a refetch is in flight. */
  deferredFilters: F;
  /** Search to feed the query — lags `search` while a refetch is in flight. */
  deferredSearch: string;
  /**
   * A paged list's cursor to feed the query — lags the URL's cursor while the next page is read, so the page on
   * screen stays (dimmed) instead of dropping to the Suspense fallback.
   */
  deferredCursor: string | null;
  /**
   * True while either deferred value lags its live counterpart: a refetch is in
   * flight and the rows on screen are the previous result. Use it to guard
   * empty states (never conclude "no data" from stale rows) and to dim the
   * stale content.
   */
  isPending: boolean;
}

/**
 * Defers a table's query variables (filters + search, and a paged list's cursor) so a filter/search/page
 * interaction keeps the current rows on screen while the refetch is in flight,
 * instead of dropping the table to its Suspense fallback. The LIVE values keep
 * driving the controls (checkboxes, input) so they respond instantly.
 *
 * Relies on `filters` being reference-stable per value (build it with `useMemo`
 * from `useApiParams` state) — `isPending` is an identity comparison.
 */
export function useDeferredQuery<F>(
  filters: F,
  search: string,
  cursor: string | null = null,
): UseDeferredQueryResult<F> {
  const deferredFilters = useDeferredValue(filters);
  const deferredSearch = useDeferredValue(search);
  const deferredCursor = useDeferredValue(cursor);
  return {
    deferredFilters,
    deferredSearch,
    deferredCursor,
    isPending: deferredFilters !== filters || deferredSearch !== search || deferredCursor !== cursor,
  };
}
