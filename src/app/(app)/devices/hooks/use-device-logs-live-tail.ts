'use client';

import { useEffect, useRef, useState } from 'react';
import { fetchQuery, useRelayEnvironment } from 'react-relay';
import type { deviceLogsRelayPollQuery as PollQueryType } from '@/__generated__/deviceLogsRelayPollQuery.graphql';
import { useSubscriptionOpen } from '@/app/components/subscription-lock/subscription-guard';
import { DEVICE_LOGS_POLL_SIZE, deviceLogsRelayPollQuery } from '@/graphql/devices/device-logs-relay';
import type { DeviceLogFilter, UiDeviceLog } from '../types/device-log.types';
import { describeDeviceLogError, type DeviceLogErrorInfo } from '../utils/device-log-errors';
import { mergeFreshLines, pollBackoffMs } from '../utils/device-log-tail';
import { toUiDeviceLog } from '../utils/device-log-transform';

/** New lines reach the platform about once a minute; polling faster than this shows nothing sooner. */
const DEVICE_LOGS_POLL_INTERVAL_MS = 5_000;
/** A burst larger than this many poll pages is left for the next tick. */
const MAX_POLL_PAGES = 10;

interface UseDeviceLogsLiveTailOptions {
  machineId: string;
  /** The list's own filter, so a poll never returns a line the list would not show. */
  filter: DeviceLogFilter;
  /** Identity of the list the fresh lines belong to; a change discards them. */
  listKey: string;
  /** Newest line on screen — the poll's inclusive `from`. Null while the list is empty. */
  newestTimestamp: string | null;
  /** The toggle, AND "not while the list itself is loading". */
  enabled: boolean;
  /** Polling pauses while the user has scrolled away from the top. */
  atTop: boolean;
}

interface FreshState {
  listKey: string;
  lines: UiDeviceLog[];
  error: DeviceLogErrorInfo | null;
}

interface UseDeviceLogsLiveTailResult {
  /** Lines newer than the list holds, newest first. */
  freshLines: UiDeviceLog[];
  /** The last poll failure; cleared by the next successful poll. */
  error: DeviceLogErrorInfo | null;
}

/**
 * The 5-second auto-update (FE-17…FE-21): a probe whose inclusive `from` is the
 * newest line on screen, so that line returns and a nanosecond compare drops it.
 * Fresh lines live in React state — the connection's cursors are its own.
 */
export function useDeviceLogsLiveTail({
  machineId,
  filter,
  listKey,
  newestTimestamp,
  enabled,
  atTop,
}: UseDeviceLogsLiveTailOptions): UseDeviceLogsLiveTailResult {
  const environment = useRelayEnvironment();
  // A query, so the network gate parks it behind the paywall anyway; asking
  // here as well keeps the timer itself quiet on a locked workspace.
  const subscriptionOpen = useSubscriptionOpen();

  const [fresh, setFresh] = useState<FreshState>({ listKey, lines: [], error: null });
  // Outside the effect: `atTop` restarts it, and a ladder that resets on every
  // scroll is no ladder at all.
  const failuresRef = useRef(0);
  const current = fresh.listKey === listKey ? fresh : null;

  // Latest-value refs, written after the commit: the reader is the poll timer.
  const newestRef = useRef<string | null>(null);
  useEffect(() => {
    newestRef.current = current?.lines[0]?.timestamp ?? newestTimestamp;
  });

  const active = enabled && atTop && subscriptionOpen;

  useEffect(() => {
    if (!active) return undefined;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let inFlight = false;
    // `deviceLogs` is newest-first and `after` walks OLDER, so a burst that
    // outruns MAX_POLL_PAGES resumes from the same `from` and the same cursor —
    // advancing the tail would strand every line below it.
    let walkFrom: string | null = null;
    let walkAfter: string | null = null;
    let walkLines: UiDeviceLog[] = [];
    // Fallback lower bound for a list that holds nothing yet: the filter's own
    // window, else "now" — never the API's 7-day default on every tick.
    const emptyListFrom = filter.from ?? new Date().toISOString();

    const schedule = (delay: number) => {
      clearTimeout(timer);
      timer = setTimeout(tick, delay);
    };

    async function tick(): Promise<void> {
      if (cancelled || inFlight) return;
      // Nothing to show while hidden; `visibilitychange` below resumes.
      if (document.visibilityState === 'hidden') return;
      // A custom window that has ENDED cannot grow. One whose end is still
      // ahead can, so gating on `to` being set at all froze today's range.
      if (filter.to !== undefined && Date.parse(filter.to) <= Date.now()) return;

      inFlight = true;
      const from = walkFrom ?? newestRef.current ?? emptyListFrom;
      try {
        const collected: UiDeviceLog[] = [];
        let after: string | null = walkAfter;
        let capped = false;
        for (let page = 0; page < MAX_POLL_PAGES; page++) {
          const variables: PollQueryType['variables'] = {
            machineId,
            filter: { ...filter, from },
            first: DEVICE_LOGS_POLL_SIZE,
            after,
          };
          const response: PollQueryType['response'] | undefined = await fetchQuery<PollQueryType>(
            environment,
            deviceLogsRelayPollQuery,
            variables,
            { fetchPolicy: 'network-only' },
          ).toPromise();
          if (cancelled) return;
          const connection: PollQueryType['response']['deviceLogs'] | undefined = response?.deviceLogs;
          if (!connection) break;
          collected.push(...connection.edges.map(edge => toUiDeviceLog(edge.cursor, edge.node)));
          if (!connection.pageInfo.hasNextPage || !connection.pageInfo.endCursor) break;
          after = connection.pageInfo.endCursor;
          capped = page === MAX_POLL_PAGES - 1;
        }

        failuresRef.current = 0;
        // Nothing is published until the walk drains: its batches run newest to
        // older, so a partial one prepended now would sit above lines newer
        // than itself.
        if (capped) {
          walkFrom = from;
          walkAfter = after;
          walkLines = [...walkLines, ...collected];
          schedule(DEVICE_LOGS_POLL_INTERVAL_MS);
          return;
        }

        const drained = walkLines.length > 0 ? [...walkLines, ...collected] : collected;
        walkFrom = null;
        walkAfter = null;
        walkLines = [];
        // Compared against the walk's own bound, not a tail that moved under us.
        setFresh(prev => {
          const lines = prev.listKey === listKey ? prev.lines : [];
          const merged = mergeFreshLines(lines, drained, from);
          if (merged === null) return prev.error || prev.listKey !== listKey ? { listKey, lines, error: null } : prev;
          return { listKey, lines: merged, error: null };
        });
        schedule(DEVICE_LOGS_POLL_INTERVAL_MS);
      } catch (error) {
        if (cancelled) return;
        const info = describeDeviceLogError(error, {
          hasSearch: Boolean(filter.contains?.length || filter.excludes?.length),
        });
        setFresh(prev => ({ listKey, lines: prev.listKey === listKey ? prev.lines : [], error: info }));
        // A vanished device or a rejected filter cannot recover by waiting; the
        // list's own error handling owns those. Everything else backs off.
        if (info.kind === 'not-found' || info.kind === 'validation') return;
        schedule(pollBackoffMs(failuresRef.current));
        failuresRef.current += 1;
      } finally {
        inFlight = false;
      }
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') schedule(DEVICE_LOGS_POLL_INTERVAL_MS);
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    schedule(DEVICE_LOGS_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [environment, machineId, filter, listKey, active]);

  // A stopped tail reports no failure: with the toggle off (or the workspace
  // locked) the strip would name a poll that is no longer being attempted.
  return { freshLines: current?.lines ?? [], error: active ? (current?.error ?? null) : null };
}
