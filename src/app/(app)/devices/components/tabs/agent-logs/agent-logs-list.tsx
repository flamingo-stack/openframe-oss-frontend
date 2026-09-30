'use client';

import { ClipboardListIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { useCallback, useMemo, useState } from 'react';
import { fetchQuery, graphql, useLazyLoadQuery, usePaginationFragment, useRelayEnvironment } from 'react-relay';
import type { agentLogsList_query$key } from '@/__generated__/agentLogsList_query.graphql';
import type { agentLogsListPaginationQuery } from '@/__generated__/agentLogsListPaginationQuery.graphql';
import type { agentLogsListQuery, agentLogsListQuery$variables } from '@/__generated__/agentLogsListQuery.graphql';
import { SectionLoadError, useRetryKey } from '@/app/components/shared';
import { formatDate } from '@/lib/format-date';
import { useDeviceLogsLiveTail } from '../../../hooks/use-device-logs-live-tail';
import { useGridInfiniteScroll } from '../../../hooks/use-grid-infinite-scroll';
import { useIsAtTop } from '../../../hooks/use-is-at-top';
import { groupByLocalDay } from '../../../utils/device-log-time';
import { TabEmptyState } from '../tab-empty-state';
import { AgentLogRow } from './agent-log-row';
import { AgentLogsRowsSkeleton } from './agent-logs-skeleton';

const PAGE_SIZE = 100;

export type AgentLogsFilter = NonNullable<agentLogsListQuery$variables['filter']>;

const agentLogsListQueryNode = graphql`
  query agentLogsListQuery($machineId: String!, $filter: DeviceLogFilterInput, $first: Int!, $after: String) {
    ...agentLogsList_query @arguments(machineId: $machineId, filter: $filter, first: $first, after: $after)
  }
`;

// Keyed on the machine and the filter: cursors belong to the filter that made them.
const agentLogsListFragment = graphql`
  fragment agentLogsList_query on Query
  @refetchable(queryName: "agentLogsListPaginationQuery")
  @argumentDefinitions(
    machineId: { type: "String!" }
    filter: { type: "DeviceLogFilterInput" }
    first: { type: "Int!" }
    after: { type: "String" }
  ) {
    deviceLogs(machineId: $machineId, filter: $filter, first: $first, after: $after)
      @connection(key: "agentLogsList_deviceLogs", filters: ["machineId", "filter"]) {
      edges {
        cursor
        node {
          timestamp
          ...agentLogRow_entry
        }
      }
    }
  }
`;

interface AgentLogsListProps {
  machineId: string;
  filter: AgentLogsFilter;
  deviceHostname: string;
  /** The rows lag the controls while a filter change is in flight. */
  isPending: boolean;
  autoUpdate: boolean;
  hasFilters: boolean;
  onResetFilters: () => void;
}

/** The list, newest first, grouped by local day; older pages on scroll, the head re-read by the live tail. Remounted per filter. */
export function AgentLogsList({
  machineId,
  filter,
  deviceHostname,
  isPending,
  autoUpdate,
  hasFilters,
  onResetFilters,
}: AgentLogsListProps) {
  const environment = useRelayEnvironment();
  const retryKey = useRetryKey();
  const variables = useMemo(() => ({ machineId, filter, first: PAGE_SIZE, after: null }), [machineId, filter]);
  const queryData = useLazyLoadQuery<agentLogsListQuery>(agentLogsListQueryNode, variables, {
    fetchPolicy: 'store-and-network',
    fetchKey: retryKey,
  });
  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    agentLogsListPaginationQuery,
    agentLogsList_query$key
  >(agentLogsListFragment, queryData);
  const edges = data.deviceLogs.edges;

  // The same first page, network-only: the connection is replaced from the store, so nothing is merged by hand.
  const reload = useCallback(
    () =>
      fetchQuery<agentLogsListQuery>(environment, agentLogsListQueryNode, variables, { fetchPolicy: 'network-only' }),
    [environment, variables],
  );
  const { ref: topRef, atTop } = useIsAtTop<HTMLDivElement>();
  const { failed: tailFailed } = useDeviceLogsLiveTail({
    reload,
    enabled: autoUpdate && !isPending && !isLoadingNext,
    atTop,
  });

  const [loadMoreFailed, setLoadMoreFailed] = useState(false);
  const fetchNextPage = () => {
    if (!hasNext || isLoadingNext) return;
    setLoadMoreFailed(false);
    loadNext(PAGE_SIZE, {
      onComplete: error => {
        if (error) setLoadMoreFailed(true);
      },
    });
  };
  const bottomRef = useGridInfiniteScroll({
    enabled: edges.length > 0 && !loadMoreFailed,
    hasNextPage: hasNext,
    isFetchingNextPage: isLoadingNext,
    fetchNextPage,
  });

  // `Instant` is an unmapped scalar (`any` in the artifact).
  const days = groupByLocalDay(
    edges,
    edge => String(edge.node.timestamp),
    edge => edge.cursor,
  );

  return (
    <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
      <div ref={topRef} aria-hidden="true" className="h-px" />
      {tailFailed && <SectionLoadError message="Auto-update failed. Retrying in 30 seconds." />}
      {edges.length === 0 ? (
        isPending ? (
          <AgentLogsRowsSkeleton />
        ) : (
          <TabEmptyState
            icon={<ClipboardListIcon />}
            title="No logs in this range"
            description="Nothing matched the current range and filters."
            buttonLabel={hasFilters ? 'Reset filters' : undefined}
            onButtonClick={hasFilters ? onResetFilters : undefined}
          />
        )
      ) : (
        <div
          aria-busy={isPending || isLoadingNext}
          className={cn(
            'flex flex-col gap-[var(--spacing-system-xxs)] transition-opacity motion-reduce:transition-none',
            isPending && 'opacity-60',
          )}
        >
          {days.map(day => (
            <section key={day.key} className="flex flex-col gap-[var(--spacing-system-xxs)]">
              <div className="flex items-center gap-[var(--spacing-system-xs)] pb-[var(--spacing-system-xxs)] pt-[var(--spacing-system-s)]">
                <span className="text-ods-text-secondary text-h5">{formatDate(day.date)}</span>
                <span aria-hidden="true" className="h-px flex-1 bg-ods-border" />
              </div>
              {day.rows.map(row => (
                <AgentLogRow key={row.key} entry={row.item.node} deviceHostname={deviceHostname} />
              ))}
            </section>
          ))}
        </div>
      )}
      <div ref={bottomRef} aria-hidden="true" className="h-px" />
      {isLoadingNext && <AgentLogsRowsSkeleton rows={3} />}
      {loadMoreFailed && <SectionLoadError message="Couldn't load older logs." onRetry={fetchNextPage} />}
      {edges.length > 0 && !hasNext && (
        <p className="py-[var(--spacing-system-s)] text-center text-ods-text-secondary text-h6">
          No older logs in this range
        </p>
      )}
    </div>
  );
}
