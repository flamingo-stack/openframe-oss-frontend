'use client';

import { useEffect, useRef } from 'react';
import { subscribeConnectivity } from '@/lib/connectivity';

/**
 * While `waiting` — something failed for want of a link — runs `retry` when the
 * link comes back, once per reconnect: the rule `ContentErrorBoundary` follows.
 */
export function useRetryOnReconnect(waiting: boolean, retry: () => void): void {
  const latest = useRef(retry);
  useEffect(() => {
    latest.current = retry;
  });

  useEffect(() => {
    if (!waiting) return undefined;
    // Answers at once with the current state too: a link back before this
    // subscribed is a reconnect this listener would otherwise never see.
    return subscribeConnectivity(online => {
      if (online) latest.current();
    });
  }, [waiting]);
}
