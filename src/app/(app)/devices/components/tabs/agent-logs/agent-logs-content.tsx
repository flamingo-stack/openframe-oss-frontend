'use client';

import { ClipboardListIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLazyLoadQuery, usePaginationFragment } from 'react-relay';
import type { deviceLogsRelay_query$key } from '@/__generated__/deviceLogsRelay_query.graphql';
import type { deviceLogsRelayPaginationQuery as PaginationQueryType } from '@/__generated__/deviceLogsRelayPaginationQuery.graphql';
import type { deviceLogsRelayQuery as QueryType } from '@/__generated__/deviceLogsRelayQuery.graphql';
import { SectionLoadError, useRetryKey } from '@/app/components/shared';
import {
  DEVICE_LOGS_PAGE_SIZE,
  deviceLogsRelayFragment,
  deviceLogsRelayQuery,
} from '@/graphql/devices/device-logs-relay';
import { useDeviceLogsLiveTail } from '../../../hooks/use-device-logs-live-tail';
import { useIsAtTop } from '../../../hooks/use-is-at-top';
import type { DeviceLogFilter, UiDeviceLog } from '../../../types/device-log.types';
import { describeDeviceLogError, type DeviceLogErrorInfo } from '../../../utils/device-log-errors';
import { deviceLogDay, formatDeviceLogDay } from '../../../utils/device-log-time';
import { toUiDeviceLog } from '../../../utils/device-log-transform';
import { TabEmptyState } from '../tab-empty-state';
import { AgentLogRow } from './agent-log-row';
import { AgentLogsRowsSkeleton } from './agent-logs-skeleton';

/** One list = one machine + one filter + one refresh; everything below restarts when it changes. */
export interface AgentLogsList {
  filter: DeviceLogFilter;
  key: string;
}

/** Row is one item, a day separator is another — so index ↔ item stays 1:1. */
type LogItem =
  { kind: 'day'; key: string; timestamp: string } | { kind: 'line'; key: string; line: UiDeviceLog; posinset: number };

/** Exact, not a guess: a collapsed row is one line at every width, and the level
 *  chip fixes its height. Only an expanded row measures past it. */
const ROW_ESTIMATE_PX = 40;
/** `--spacing-system-xxs`, which is 4px at every breakpoint. */
const ROW_GAP_PX = 4;
/** Rows from the end at which the next page is requested. */
const LOAD_MORE_PREFETCH = 20;

interface AgentLogsContentProps {
  machineId: string;
  /** FE-6 compares the line's hostname against this before showing it inline. */
  deviceHostname: string;
  /** The DEFERRED list — the rows on screen lag the controls while a change is in flight. */
  list: AgentLogsList;
  /** True while `list` lags the live controls: stale rows dim, and never read as "empty". */
  isPending: boolean;
  autoUpdate: boolean;
  hasSearch: boolean;
  /** True when the range starts before the production retention window. */
  beyondRetention: boolean;
  hasActiveFilters: boolean;
  onResetFilters: () => void;
}

export function AgentLogsContent({
  machineId,
  deviceHostname,
  list,
  isPending,
  autoUpdate,
  hasSearch,
  beyondRetention,
  hasActiveFilters,
  onResetFilters,
}: AgentLogsContentProps) {
  const retryKey = useRetryKey();
  const queryData = useLazyLoadQuery<QueryType>(
    deviceLogsRelayQuery,
    { machineId, filter: list.filter, first: DEVICE_LOGS_PAGE_SIZE, after: null },
    // The list key in `fetchKey` makes a manual refresh re-issue the first page
    // even when the filter did not change (a custom range).
    { fetchPolicy: 'store-and-network', fetchKey: `${retryKey}:${list.key}` },
  );
  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    PaginationQueryType,
    deviceLogsRelay_query$key
  >(deviceLogsRelayFragment, queryData);

  const olderLines = useMemo(
    () => data.deviceLogs.edges.map(edge => toUiDeviceLog(edge.cursor, edge.node)),
    [data.deviceLogs.edges],
  );

  const { ref: topRef, atTop } = useIsAtTop<HTMLDivElement>();
  const { freshLines, error: pollError } = useDeviceLogsLiveTail({
    machineId,
    filter: list.filter,
    listKey: list.key,
    newestTimestamp: olderLines[0]?.timestamp ?? null,
    enabled: autoUpdate && !isPending,
    atTop,
  });
  // Memoized by hand on purpose: `useVirtualizer` makes the compiler skip this
  // component, so nothing else keeps `items` from rebuilding every render.
  const lines = useMemo(
    () => (freshLines.length > 0 ? [...freshLines, ...olderLines] : olderLines),
    [freshLines, olderLines],
  );

  // FE-22 renders only the visible window, so a day separator cannot be a
  // sibling of the row it precedes — it becomes an item with its own index.
  const items = useMemo<LogItem[]>(() => {
    const out: LogItem[] = [];
    let lastDay = '';
    let ordinal = 0;
    for (const line of lines) {
      const day = deviceLogDay(line.timestamp);
      if (day !== lastDay) {
        out.push({ kind: 'day', key: `day:${day}`, timestamp: line.timestamp });
        lastDay = day;
      }
      ordinal += 1;
      out.push({ kind: 'line', key: line.key, line, posinset: ordinal });
    }
    return out;
  }, [lines]);

  // Expansion is the list's state now: a virtualized row unmounts when it
  // scrolls out, and would lose its own.
  const [expandedKeys, setExpandedKeys] = useState<ReadonlySet<string>>(() => new Set<string>());
  const [expandedFor, setExpandedFor] = useState(list.key);
  if (expandedFor !== list.key) {
    setExpandedFor(list.key);
    setExpandedKeys(new Set<string>());
  }
  const toggleExpanded = useCallback((key: string) => {
    setExpandedKeys(prev => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }, []);

  const [listEl, setListEl] = useState<HTMLDivElement | null>(null);
  const [scroller, setScroller] = useState<HTMLElement | null>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  // The scroller is the shell's <main> — this feature owns no scroll container,
  // and <main> exposes no ref, so it is resolved from our own node.
  useLayoutEffect(() => {
    setScroller(listEl?.closest('main') ?? null);
  }, [listEl]);

  useLayoutEffect(() => {
    if (!listEl || !scroller) return undefined;
    const measure = () => {
      const next = listEl.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
      setScrollMargin(prev => (Math.abs(prev - next) > 1 ? next : prev));
    };
    measure();
    // Everything above the list can change height (search hint, poll strip, the
    // md: flip), and every one of those moves the list's top.
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    let above: HTMLElement | null = listEl;
    while (above && above.parentElement !== scroller) above = above.parentElement;
    if (above) observer.observe(above);
    return () => observer.disconnect();
  }, [listEl, scroller]);

  // Called DIRECTLY, never behind a wrapper hook: React Compiler lists
  // useVirtualizer as incompatible and skips this component, which is what keeps
  // the mutated virtualizer out of an identity-keyed cache (the DataTable freeze).
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scroller,
    estimateSize: () => ROW_ESTIMATE_PX,
    getItemKey: index => items[index]?.key ?? index,
    overscan: 8,
    gap: ROW_GAP_PX,
    scrollMargin,
  });

  // Expanding a row changes its height, and waiting for the ResizeObserver to
  // say so is not safe: a browser does not deliver one to a tab it is not
  // rendering, which would leave the opened row overlapping the next.
  useLayoutEffect(() => {
    if (!listEl) return;
    listEl.querySelectorAll<HTMLElement>('[data-index]').forEach(node => {
      virtualizer.measureElement(node);
    });
  }, [expandedKeys, listEl, virtualizer]);

  // Keyed to the list: a failed page belongs to the filter that asked for it,
  // and only `fetchNextPage` clears it — so without this a new list would
  // inherit the strip AND the disabled trigger that comes with it.
  const [loadMore, setLoadMore] = useState<{ listKey: string; error: DeviceLogErrorInfo } | null>(null);
  const loadMoreError = loadMore?.listKey === list.key ? loadMore.error : null;
  const fetchNextPage = () => {
    if (!hasNext || isLoadingNext) return;
    setLoadMore(null);
    loadNext(DEVICE_LOGS_PAGE_SIZE, {
      onComplete: error => {
        if (error) setLoadMore({ listKey: list.key, error: describeDeviceLogError(error, { hasSearch }) });
      },
    });
  };

  // Written after the commit, so the index effect below can stay keyed on
  // primitives instead of re-running on every render.
  const fetchRef = useRef(fetchNextPage);
  useEffect(() => {
    fetchRef.current = fetchNextPage;
  });

  const virtualItems = virtualizer.getVirtualItems();
  const lastRenderedIndex = virtualItems.length > 0 ? virtualItems[virtualItems.length - 1].index : -1;
  // The sentinel node is gone with virtualization — the last rendered index is
  // what "near the end" means now.
  useEffect(() => {
    if (loadMoreError !== null) return;
    if (lastRenderedIndex >= 0 && lastRenderedIndex >= items.length - 1 - LOAD_MORE_PREFETCH) fetchRef.current();
  }, [lastRenderedIndex, items.length, loadMoreError]);

  // The sentinel sits above every state, so the live tail keeps its "at the
  // top" answer when the list empties and fills again.
  const topSentinel = <div ref={topRef} aria-hidden="true" className="h-px" />;

  // Shown in EVERY state: on a list that is legitimately empty, a dead poll is
  // the only thing that would ever fill it, so silence there reads as
  // "nothing happened" when the truth is "we stopped looking".
  const pollErrorStrip = pollError ? (
    <SectionLoadError
      message={
        pollError.kind === 'offline' ? pollError.message : `Auto-update paused: ${pollError.message.toLowerCase()}`
      }
    />
  ) : null;

  if (lines.length === 0) {
    if (isPending) {
      return (
        <>
          {topSentinel}
          {pollErrorStrip}
          <AgentLogsRowsSkeleton />
        </>
      );
    }
    return (
      <>
        {topSentinel}
        {pollErrorStrip}
        <TabEmptyState
          icon={<ClipboardListIcon />}
          title="No logs in this range"
          description={
            beyondRetention
              ? 'Agent logs are kept for 10 days. Try a narrower range or different filters.'
              : 'Nothing matched the current range and filters.'
          }
          buttonLabel={hasActiveFilters ? 'Reset filters' : undefined}
          onButtonClick={hasActiveFilters ? onResetFilters : undefined}
        />
      </>
    );
  }

  const lineCount = lines.length;

  return (
    <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
      {topSentinel}
      {pollErrorStrip}
      <div
        ref={setListEl}
        role="list"
        aria-busy={isPending || isLoadingNext}
        // `overflow-anchor` off: the browser's own anchoring fights a
        // transform-positioned list instead of helping it.
        className={cn('relative w-full transition-opacity [overflow-anchor:none]', isPending && 'opacity-60')}
        style={{ height: virtualizer.getTotalSize() }}
      >
        {virtualItems.map(virtualItem => {
          const item = items[virtualItem.index];
          if (!item) return null;
          const style = {
            position: 'absolute' as const,
            top: 0,
            left: 0,
            width: '100%',
            transform: `translateY(${virtualItem.start - scrollMargin}px)`,
          };
          if (item.kind === 'day') {
            return (
              <div
                key={virtualItem.key}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                role="presentation"
                style={style}
              >
                {/* The row shows a time only (spec §4), so the date has to live
                    somewhere: one separator per UTC day, in the order's own units. */}
                <div className="flex items-center gap-[var(--spacing-system-xs)] pb-[var(--spacing-system-xxs)] pt-[var(--spacing-system-s)]">
                  <span className="text-ods-text-secondary text-h5">{formatDeviceLogDay(item.timestamp)} · UTC</span>
                  <span className="h-px flex-1 bg-ods-border" />
                </div>
              </div>
            );
          }
          return (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              role="listitem"
              aria-setsize={lineCount}
              aria-posinset={item.posinset}
              style={style}
            >
              <AgentLogRow
                line={item.line}
                deviceHostname={deviceHostname}
                expanded={expandedKeys.has(item.key)}
                onToggle={toggleExpanded}
              />
            </div>
          );
        })}
      </div>
      {isLoadingNext && <AgentLogsRowsSkeleton rows={3} />}
      {loadMoreError && (
        <SectionLoadError
          message={loadMoreError.message}
          onRetry={loadMoreError.kind === 'offline' ? undefined : fetchNextPage}
        />
      )}
      {!hasNext && (
        <p className="py-[var(--spacing-system-s)] text-center text-ods-text-secondary text-h6">
          No older logs in this range
        </p>
      )}
    </div>
  );
}
