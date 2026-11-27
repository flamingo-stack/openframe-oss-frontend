'use client';

import {
  AUTO_REFRESH_OFF,
  type AutoRefreshOption,
  autoRefreshIntervalMs,
  DEFAULT_AUTO_REFRESH_OPTIONS,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useApiParams } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useSubscriptionOpen } from '@/app/components/subscription-lock/subscription-guard';
import { useSessionHealthStore } from '@/lib/session-health';
import { sessionInterval, sessionPollsAllowed } from '@/lib/session-poll';

const REFRESH_SCHEMA = { refresh: { type: 'string', default: AUTO_REFRESH_OFF } } as const;

function subscribeVisibility(onChange: () => void): () => void {
  document.addEventListener('visibilitychange', onChange);
  return () => document.removeEventListener('visibilitychange', onChange);
}

/** The tab is shown (a hidden tab polls nothing). */
function useDocumentVisible(): boolean {
  return useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState === 'visible',
    () => false,
  );
}

export interface UseAutoRefreshOptions {
  /** The table's URL prefix: the interval lives at `?<prefix>Refresh=`. */
  prefix?: string;
  /**
   * Refetch the page on screen, silently (a Relay table: `useRefetchPage`). Resolves when the answer is in; the next
   * tick waits for it, so one request is in flight at most. Omit on a react-query table: read `queryInterval`.
   */
  refetch?: () => Promise<unknown>;
  options?: readonly AutoRefreshOption[];
}

export interface UseAutoRefreshReturn {
  /** For `AutoRefreshControl` (`LiveTable`'s `refresh`). */
  control: { value: string; onChange: (value: string) => void; options: readonly AutoRefreshOption[] };
  /** The chosen interval in ms; `null` when off. */
  intervalMs: number | null;
  /**
   * A react-query table's `refetchInterval`: the interval while the subscription is open and the tab shown, gated on
   * the session (`sessionInterval`). Pair it with `retry: sessionRetry(n)` and `meta: sessionPollMeta`.
   */
  queryInterval: false | (() => number | false);
}

/**
 * The table's auto-refresh: an interval in the URL (off by default), a timer that refetches the page on screen
 * silently. It ticks only while the session is healthy, the subscription open and the tab shown, starts again when
 * all three hold again, and never refetches while the last refetch is still out.
 */
export function useAutoRefresh({
  prefix,
  refetch,
  options = DEFAULT_AUTO_REFRESH_OPTIONS,
}: UseAutoRefreshOptions = {}): UseAutoRefreshReturn {
  const { params, setParam } = useApiParams(REFRESH_SCHEMA, { prefix });
  const known = options.some(option => option.value === params.refresh);
  const intervalMs = known ? autoRefreshIntervalMs(params.refresh) : null;
  const healthy = useSessionHealthStore(state => state.health === 'healthy');
  const subscriptionOpen = useSubscriptionOpen();
  const visible = useDocumentVisible();
  const running = intervalMs !== null && healthy && subscriptionOpen && visible;

  // The latest refetch, read by the timer: a new page's refetch replaces the old one without restarting the timer.
  const refetchRef = useRef(refetch);
  useEffect(() => {
    refetchRef.current = refetch;
  }, [refetch]);

  useEffect(() => {
    if (!running || intervalMs === null || !refetchRef.current) return undefined;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      if (cancelled) return;
      if (sessionPollsAllowed()) {
        try {
          await refetchRef.current?.();
        } catch {
          // A failed refresh keeps the page and its cursor; the next tick tries again.
        }
      }
      if (!cancelled) timer = setTimeout(() => void tick(), intervalMs);
    };
    timer = setTimeout(() => void tick(), intervalMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [running, intervalMs]);

  const onChange = (value: string) => setParam('refresh', value);

  return {
    control: { value: known ? params.refresh : AUTO_REFRESH_OFF, onChange, options },
    intervalMs,
    queryInterval: intervalMs !== null && subscriptionOpen && visible ? sessionInterval(intervalMs) : false,
  };
}
