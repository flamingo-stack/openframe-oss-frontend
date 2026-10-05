'use client';

import { useCallback, useRef } from 'react';

/**
 * Merges same-tick `useApiParams` writes into ONE URL update, then scrolls the
 * page back to the top.
 *
 * Why it exists: the mobile `FilterModal` commits its funnel selection and its
 * date section as two callbacks in the same tick — `onFilterChange(...)`
 * immediately followed by `dateFilter.onChange(...)` inside its Apply/Reset
 * handler. `setParams` builds the next URL from the search string of the render
 * it was created in, so two sequential calls both start from the SAME stale base
 * and the second `router.replace` wins: whichever group the user changed first
 * is silently dropped. On Apply that means the funnels lose their new selection
 * whenever a date range is applied alongside them; on Reset it means the funnels
 * never clear.
 *
 * Queueing into a microtask merges everything that arrives in that tick and
 * writes once. The scroll fires eagerly (a filter change always sends the list
 * back to the top) and is idempotent, so a merged pair scrolls exactly once too.
 *
 * @param setParams The `setParams` from that component's `useApiParams`.
 */
export function useQueuedParamsWrite<Params extends Record<string, unknown>>(
  setParams: (updates: Params) => void,
): (updates: Params) => void {
  const pendingRef = useRef<Params | null>(null);

  return useCallback(
    (updates: Params) => {
      if (pendingRef.current) {
        Object.assign(pendingRef.current, updates);
        return;
      }
      // Copied, not held by reference: the merge above must never mutate an
      // object the caller still owns.
      pendingRef.current = { ...updates };
      queueMicrotask(() => {
        const merged = pendingRef.current;
        pendingRef.current = null;
        if (merged) {
          setParams(merged);
        }
      });
      document.querySelector('main')?.scrollTo({ top: 0, behavior: 'instant' });
    },
    [setParams],
  );
}
