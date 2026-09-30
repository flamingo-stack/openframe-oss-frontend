'use client';

import { useEffect, useState } from 'react';
import type { Observable, Subscription } from 'relay-runtime';
import { useSubscriptionOpen } from '@/app/components/subscription-lock/subscription-guard';

export const DEVICE_LOGS_POLL_INTERVAL_MS = 5_000;
export const DEVICE_LOGS_RETRY_INTERVAL_MS = 30_000;

interface UseDeviceLogsLiveTailOptions {
  /** Re-reads the head of the list into the store; stable per list (`useCallback`), a new one restarts the timer. */
  reload: () => Observable<unknown>;
  enabled: boolean;
  /** Paused while scrolled away: the head replaces the list, which would pull older pages from under the reader. */
  atTop: boolean;
}

/** Reloads the head of the list every 5 s while visible, at the top and unlocked; one request at a time, 30 s after a failure. */
export function useDeviceLogsLiveTail({ reload, enabled, atTop }: UseDeviceLogsLiveTailOptions): { failed: boolean } {
  const subscriptionOpen = useSubscriptionOpen();
  // The reload that failed, so a new list never inherits the strip.
  const [failure, setFailure] = useState<(() => Observable<unknown>) | null>(null);

  const active = enabled && atTop && subscriptionOpen;

  useEffect(() => {
    if (!active) return undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let request: Subscription | null = null;

    const schedule = (delay: number) => {
      clearTimeout(timer);
      timer = setTimeout(tick, delay);
    };

    function tick() {
      if (request) return;
      if (document.visibilityState === 'hidden') {
        schedule(DEVICE_LOGS_POLL_INTERVAL_MS);
        return;
      }
      reload().subscribe({
        start: subscription => {
          request = subscription;
        },
        complete: () => {
          request = null;
          setFailure(null);
          schedule(DEVICE_LOGS_POLL_INTERVAL_MS);
        },
        error: () => {
          request = null;
          setFailure(() => reload);
          schedule(DEVICE_LOGS_RETRY_INTERVAL_MS);
        },
      });
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') schedule(0);
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    schedule(DEVICE_LOGS_POLL_INTERVAL_MS);

    return () => {
      clearTimeout(timer);
      request?.unsubscribe();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [active, reload]);

  return { failed: active && failure === reload };
}
