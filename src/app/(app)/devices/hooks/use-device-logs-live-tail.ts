'use client';

import { useEffect, useRef, useState } from 'react';
import { commitLocalUpdate, useRelayEnvironment } from 'react-relay';
import type { Observable, Subscription } from 'relay-runtime';
import { useSubscriptionOpen } from '@/app/components/subscription-lock/subscription-guard';
import { describeDeviceLogError, type DeviceLogErrorInfo } from '../utils/device-log-errors';
import { pollBackoffMs, type PolledPage, prependNewerLines } from '../utils/device-log-tail';

/** New lines reach the platform about once a minute; polling faster shows nothing sooner. */
export const DEVICE_LOGS_POLL_INTERVAL_MS = 5_000;

interface UseDeviceLogsLiveTailOptions {
  /** The list's connection record (`__id`); new lines are written into it. */
  connectionId: string;
  /** The poll itself, owned by the component that owns its document. */
  fetchNewer: (from: string) => Observable<PolledPage>;
  /** Newest line in the list — the poll's inclusive `from`. Null while the list is empty. */
  newestTimestamp: string | null;
  /** The filter's lower bound, for a list that holds nothing yet. */
  windowStart: string | undefined;
  /** A custom range that has ended cannot grow, so its tail stops. */
  windowEnd: string | undefined;
  hasSearch: boolean;
  /** The toggle, AND "not while the list itself is loading". */
  enabled: boolean;
  /** Polling pauses while the user has scrolled away from the top. */
  atTop: boolean;
  /** A poll that filled its page leaves a hole below it; the list reloads its head. */
  onGap: () => void;
}

/**
 * The 5-second auto-update (FE-17…FE-21): one request at a time, paused while
 * hidden, scrolled away or locked, backing off after failures. What it finds
 * goes into the list's own connection, so the Relay store stays the one source.
 */
export function useDeviceLogsLiveTail({
  connectionId,
  fetchNewer,
  newestTimestamp,
  windowStart,
  windowEnd,
  hasSearch,
  enabled,
  atTop,
  onGap,
}: UseDeviceLogsLiveTailOptions): { error: DeviceLogErrorInfo | null } {
  const environment = useRelayEnvironment();
  const subscriptionOpen = useSubscriptionOpen();
  const [failure, setFailure] = useState<{ connectionId: string; error: DeviceLogErrorInfo } | null>(null);
  // Outside the effect: `atTop` restarts it, and a ladder that resets on every
  // scroll is no ladder at all.
  const failuresRef = useRef(0);

  // Latest values for the timer, written after the commit; the effect keys on identity only.
  const latest = useRef({ fetchNewer, newestTimestamp, windowStart, windowEnd, hasSearch, onGap });
  useEffect(() => {
    latest.current = { fetchNewer, newestTimestamp, windowStart, windowEnd, hasSearch, onGap };
  });

  const active = enabled && atTop && subscriptionOpen;

  useEffect(() => {
    if (!active) return undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let request: Subscription | null = null;
    // "Now", not the API's 7-day default, for an empty list with an open-ended filter.
    const fallbackFrom = new Date().toISOString();

    const schedule = (delay: number) => {
      clearTimeout(timer);
      timer = setTimeout(tick, delay);
    };

    function tick() {
      const { fetchNewer: fetch, newestTimestamp: newest, windowStart: start, windowEnd: end } = latest.current;
      if (request || document.visibilityState === 'hidden') return;
      if (end !== undefined && Date.parse(end) <= Date.now()) return;

      fetch(newest ?? start ?? fallbackFrom).subscribe({
        // Held from `start`, which runs before any event: a synchronous answer
        // must not leave a finished request marked as in flight.
        start: subscription => {
          request = subscription;
        },
        next: page => {
          if (page.gap) latest.current.onGap();
          else commitLocalUpdate(environment, store => prependNewerLines(store, connectionId, page.lines));
        },
        complete: () => {
          request = null;
          failuresRef.current = 0;
          setFailure(null);
          schedule(DEVICE_LOGS_POLL_INTERVAL_MS);
        },
        error: (error: Error) => {
          request = null;
          const info = describeDeviceLogError(error, { hasSearch: latest.current.hasSearch });
          setFailure({ connectionId, error: info });
          // A vanished device or a rejected filter cannot recover by waiting; the
          // list's own error handling owns those. Everything else backs off.
          if (info.kind === 'not-found' || info.kind === 'validation') return;
          schedule(pollBackoffMs(failuresRef.current));
          failuresRef.current += 1;
        },
      });
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') schedule(DEVICE_LOGS_POLL_INTERVAL_MS);
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    schedule(DEVICE_LOGS_POLL_INTERVAL_MS);

    return () => {
      clearTimeout(timer);
      request?.unsubscribe();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [active, environment, connectionId]);

  // A stopped tail reports no failure: the strip would name a poll that is no
  // longer being attempted.
  return { error: active && failure?.connectionId === connectionId ? failure.error : null };
}
