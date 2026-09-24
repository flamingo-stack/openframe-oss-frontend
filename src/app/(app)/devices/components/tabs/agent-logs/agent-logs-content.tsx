'use client';

import { ClipboardListIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { type ReactNode, startTransition, useState } from 'react';
import { fetchQuery, graphql, useLazyLoadQuery, usePaginationFragment, useRelayEnvironment } from 'react-relay';
import type { agentLogsContent_query$key } from '@/__generated__/agentLogsContent_query.graphql';
import type { agentLogsContentPaginationQuery } from '@/__generated__/agentLogsContentPaginationQuery.graphql';
import type { agentLogsContentPollQuery } from '@/__generated__/agentLogsContentPollQuery.graphql';
import type { agentLogsContentQuery } from '@/__generated__/agentLogsContentQuery.graphql';
import { SectionLoadError, useRetryKey } from '@/app/components/shared';
import { useDeviceLogsLiveTail } from '../../../hooks/use-device-logs-live-tail';
import { useGridInfiniteScroll } from '../../../hooks/use-grid-infinite-scroll';
import { useIsAtTop } from '../../../hooks/use-is-at-top';
import type { DeviceLogFilter } from '../../../types/device-log.types';
import { describeDeviceLogError, type DeviceLogErrorInfo } from '../../../utils/device-log-errors';
import type { PolledPage } from '../../../utils/device-log-tail';
import { deviceLogDay, formatDeviceLogDay, formatDeviceLogZone } from '../../../utils/device-log-time';
import { TabEmptyState } from '../tab-empty-state';
import { AGENT_LOG_ROW_PAINT } from './agent-log-columns';
import { AgentLogRow } from './agent-log-row';
import { AgentLogsRowsSkeleton } from './agent-logs-skeleton';

/** The API maximum: a scroll page and a poll page both ask for it, so a busy device needs fewer round trips. */
const DEVICE_LOGS_PAGE_SIZE = 500;

const agentLogsContentQueryNode = graphql`
  query agentLogsContentQuery($machineId: String!, $filter: DeviceLogFilterInput, $first: Int!, $after: String) {
    ...agentLogsContent_query @arguments(machineId: $machineId, filter: $filter, first: $first, after: $after)
  }
`;

// Keyed on the machine AND the filter: cursors belong to the filter that made
// them, so a filter change starts a new list instead of appending to the old one.
const agentLogsContentFragment = graphql`
  fragment agentLogsContent_query on Query
  @refetchable(queryName: "agentLogsContentPaginationQuery")
  @argumentDefinitions(
    machineId: { type: "String!" }
    filter: { type: "DeviceLogFilterInput" }
    first: { type: "Int", defaultValue: 500 }
    after: { type: "String" }
  ) {
    deviceLogs(machineId: $machineId, filter: $filter, first: $first, after: $after)
      @connection(key: "agentLogsContent_deviceLogs", filters: ["machineId", "filter"]) {
      __id
      edges {
        node {
          __id
          timestamp
          ...agentLogRow_entry
        }
      }
    }
  }
`;

// The auto-update probe: the list's filter with `from` = its newest line. Its
// lines are moved into the list's connection by the live tail.
const agentLogsContentPollQueryNode = graphql`
  query agentLogsContentPollQuery($machineId: String!, $filter: DeviceLogFilterInput, $first: Int!) {
    deviceLogs(machineId: $machineId, filter: $filter, first: $first) {
      edges {
        cursor
        node {
          __id
          timestamp
          ...agentLogRow_entry
        }
      }
      pageInfo {
        hasNextPage
      }
    }
  }
`;

/** One list = one machine + one filter + one refresh; everything below restarts when it changes. */
export interface AgentLogsList {
  filter: DeviceLogFilter;
  key: string;
}

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
  const environment = useRelayEnvironment();
  const retryKey = useRetryKey();
  const queryData = useLazyLoadQuery<agentLogsContentQuery>(
    agentLogsContentQueryNode,
    { machineId, filter: list.filter, first: DEVICE_LOGS_PAGE_SIZE, after: null },
    // The list key in `fetchKey` makes a manual refresh re-issue the first page
    // even when the filter did not change (a custom range).
    { fetchPolicy: 'store-and-network', fetchKey: `${retryKey}:${list.key}` },
  );
  const { data, loadNext, hasNext, isLoadingNext, refetch } = usePaginationFragment<
    agentLogsContentPaginationQuery,
    agentLogsContent_query$key
  >(agentLogsContentFragment, queryData);

  const edges = data.deviceLogs.edges;
  // `Instant` is an unmapped scalar (`any` in the artifact); the wire form is a string.
  const newestTimestamp = edges.length > 0 ? String(edges[0].node.timestamp) : null;

  const { ref: topRef, atTop } = useIsAtTop<HTMLDivElement>();
  const { error: pollError } = useDeviceLogsLiveTail({
    connectionId: data.deviceLogs.__id,
    fetchNewer: from =>
      fetchQuery<agentLogsContentPollQuery>(
        environment,
        agentLogsContentPollQueryNode,
        { machineId, filter: { ...list.filter, from }, first: DEVICE_LOGS_PAGE_SIZE },
        { fetchPolicy: 'network-only' },
      ).map((answer): PolledPage => ({
        gap: answer.deviceLogs.pageInfo.hasNextPage,
        lines: answer.deviceLogs.edges.map(edge => ({
          nodeId: edge.node.__id,
          cursor: edge.cursor,
          timestamp: String(edge.node.timestamp),
        })),
      })),
    newestTimestamp,
    windowStart: list.filter.from == null ? undefined : String(list.filter.from),
    windowEnd: list.filter.to == null ? undefined : String(list.filter.to),
    hasSearch,
    enabled: autoUpdate && !isPending,
    atTop,
    // A transition, so the rows stay on screen while the head reloads.
    onGap: () =>
      startTransition(() => {
        refetch({}, { fetchPolicy: 'network-only' });
      }),
  });

  // Keyed to the list: a failed page belongs to the filter that asked for it,
  // so a new list never inherits the strip or the paused trigger.
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
  const bottomRef = useGridInfiniteScroll({
    enabled: edges.length > 0 && loadMoreError === null,
    hasNextPage: hasNext,
    isFetchingNextPage: isLoadingNext,
    fetchNextPage,
  });

  // The sentinel sits above every state, so the live tail keeps its "at the
  // top" answer when the list empties and fills again.
  const topSentinel = <div ref={topRef} aria-hidden="true" className="h-px" />;

  // Shown in EVERY state: on a list that is legitimately empty, a dead poll is
  // the only thing that would ever fill it.
  const pollErrorStrip = pollError ? (
    <SectionLoadError
      message={
        pollError.kind === 'offline' ? pollError.message : `Auto-update paused: ${pollError.message.toLowerCase()}`
      }
    />
  ) : null;

  if (edges.length === 0) {
    return (
      <>
        {topSentinel}
        {pollErrorStrip}
        {isPending ? (
          <AgentLogsRowsSkeleton />
        ) : (
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
        )}
      </>
    );
  }

  // The row shows a time only (spec §4), so the date lives in a separator per
  // local day, labelled with the zone the times are read in.
  const rows: ReactNode[] = [];
  let lastDay = '';
  for (const { node } of edges) {
    const timestamp = String(node.timestamp);
    const day = deviceLogDay(timestamp);
    if (day !== lastDay) {
      lastDay = day;
      rows.push(
        <div
          key={`day:${day}`}
          role="presentation"
          className="flex items-center gap-[var(--spacing-system-xs)] pb-[var(--spacing-system-xxs)] pt-[var(--spacing-system-s)]"
        >
          <span className="text-ods-text-secondary text-h5">
            {formatDeviceLogDay(timestamp)} · {formatDeviceLogZone(timestamp)}
          </span>
          <span className="h-px flex-1 bg-ods-border" />
        </div>,
      );
    }
    rows.push(
      <div key={node.__id} role="listitem" style={AGENT_LOG_ROW_PAINT}>
        <AgentLogRow entry={node} deviceHostname={deviceHostname} />
      </div>,
    );
  }

  return (
    <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
      {topSentinel}
      {pollErrorStrip}
      <div
        role="list"
        aria-busy={isPending || isLoadingNext}
        className={cn('flex flex-col gap-[var(--spacing-system-xxs)] transition-opacity', isPending && 'opacity-60')}
      >
        {rows}
      </div>
      <div ref={bottomRef} aria-hidden="true" className="h-px" />
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
