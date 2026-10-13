'use client';

import { useDebounce } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useState } from 'react';
import { useDeferredQuery } from '@/app/hooks/use-deferred-query';

/** How long a pick waits for the next one before its lines are asked for. */
export const DEVICE_LOG_LIST_DEBOUNCE_MS = 300;

interface KeyedList {
  /** Everything that makes it a different query; the list remounts on it. */
  key: string;
}

/**
 * The list a device-log surface hands `DeviceLogsList`, from the one its controls
 * describe. The controls never wait for it: a pick repaints them at once, and the
 * list keeps its rows, pending, until the next ones arrive.
 *
 * - The request is debounced, not the controls: three level chips clicked in a
 *   row are one query, not three. A superseded `deviceLogs` request cannot be
 *   cancelled (Relay does not unsubscribe an abandoned render from the network),
 *   and each one is a Loki scan of the whole window.
 * - The identity follows the key: the URL catching up with a pick re-parses the
 *   same values into new arrays, which must not restart the wait or read as a
 *   new list.
 *
 * `isPending` covers the wait and the request alike.
 */
export function useDeferredLogList<L extends KeyedList>(next: L): { deferredList: L; isPending: boolean } {
  const [stable, setStable] = useState(next);
  const list = stable.key === next.key ? stable : next;
  if (list !== stable) setStable(list);

  const settled = useDebounce(list, DEVICE_LOG_LIST_DEBOUNCE_MS);
  const { deferredFilters: deferredList, isPending } = useDeferredQuery(settled, '');
  return { deferredList, isPending: isPending || settled !== list };
}
