'use client';

import { ClipboardListIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { useCallback, useMemo, useState } from 'react';
import { fetchQuery, graphql, useLazyLoadQuery, usePaginationFragment, useRelayEnvironment } from 'react-relay';
import type { deviceLogsList_query$key } from '@/__generated__/deviceLogsList_query.graphql';
import type { deviceLogsListPaginationQuery } from '@/__generated__/deviceLogsListPaginationQuery.graphql';
import type { deviceLogsListQuery, deviceLogsListQuery$variables } from '@/__generated__/deviceLogsListQuery.graphql';
import { SectionLoadError, useRetryKey } from '@/app/components/shared';
import { formatDate } from '@/lib/format-date';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import { useDeviceLogsLiveTail } from '../../../hooks/use-device-logs-live-tail';
import { useGridInfiniteScroll } from '../../../hooks/use-grid-infinite-scroll';
import { useIsAtTop } from '../../../hooks/use-is-at-top';
import { groupByLocalDay } from '../../../utils/device-log-time';
import { TabEmptyState } from '../tab-empty-state';
import { DEVICE_LOG_DAY_HEADER } from './device-log-layout';
import { type DeviceLogEntry, DeviceLogRow } from './device-log-row';
import { DeviceLogsRowsSkeleton } from './device-logs-skeleton';

const PAGE_SIZE = 100;

export type DeviceLogsFilter = NonNullable<deviceLogsListQuery$variables['filter']>;

const deviceLogsListQueryNode = graphql`
  query deviceLogsListQuery($machineId: String!, $filter: DeviceLogFilterInput, $first: Int!, $after: String) {
    ...deviceLogsList_query @arguments(machineId: $machineId, filter: $filter, first: $first, after: $after)
  }
`;

// Keyed on the machine and the filter: cursors belong to the filter that made them.
const deviceLogsListFragment = graphql`
  fragment deviceLogsList_query on Query
  @refetchable(queryName: "deviceLogsListPaginationQuery")
  @argumentDefinitions(
    machineId: { type: "String!" }
    filter: { type: "DeviceLogFilterInput" }
    first: { type: "Int!" }
    after: { type: "String" }
  ) {
    deviceLogs(machineId: $machineId, filter: $filter, first: $first, after: $after)
      @connection(key: "deviceLogsList_deviceLogs", filters: ["machineId", "filter"]) {
      edges {
        cursor
        node {
          timestamp
          ...deviceLogRow_entry
        }
      }
    }
  }
`;

interface DeviceLogsListProps {
  machineId: string;
  filter: DeviceLogsFilter;
  deviceHostname: string;
  /** The rows lag the controls while a filter change is in flight. */
  isPending: boolean;
  autoUpdate: boolean;
  hasFilters: boolean;
  onResetFilters: () => void;
  /** The row open in the Log Details drawer, by its cursor. */
  selectedKey: string | null;
  onSelect: (key: string, entry: DeviceLogEntry) => void;
}

/** The list, newest first, grouped by local day; older pages on scroll, the head re-read by the live tail. Remounted per filter. */
export function DeviceLogsList({
  machineId,
  filter,
  deviceHostname,
  isPending,
  autoUpdate,
  hasFilters,
  onResetFilters,
  selectedKey,
  onSelect,
}: DeviceLogsListProps) {
  const environment = useRelayEnvironment();
  const { toast } = useToast();
  const retryKey = useRetryKey();
  const variables = useMemo(() => ({ machineId, filter, first: PAGE_SIZE, after: null }), [machineId, filter]);
  const queryData = useLazyLoadQuery<deviceLogsListQuery>(deviceLogsListQueryNode, variables, {
    fetchPolicy: 'store-and-network',
    fetchKey: retryKey,
  });
  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    deviceLogsListPaginationQuery,
    deviceLogsList_query$key
  >(deviceLogsListFragment, queryData);
  const edges = data.deviceLogs.edges;

  // The same first page, network-only: the connection is replaced from the store, so nothing is merged by hand.
  const reload = useCallback(
    () =>
      fetchQuery<deviceLogsListQuery>(environment, deviceLogsListQueryNode, variables, { fetchPolicy: 'network-only' }),
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
        if (!error) return;
        setLoadMoreFailed(true);
        toast({
          title: 'Error loading older logs',
          description: getRelayErrorMessage(error, 'Failed to load older logs'),
          variant: 'destructive',
        });
      },
    });
  };
  const bottomRef = useGridInfiniteScroll({
    enabled: edges.length > 0 && !loadMoreFailed,
    hasNextPage: hasNext,
    isFetchingNextPage: isLoadingNext,
    fetchNextPage,
  });

  const days = groupByLocalDay(
    edges,
    edge => edge.node.timestamp,
    edge => edge.cursor,
  );

  return (
    <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
      <div ref={topRef} aria-hidden="true" className="h-px" />
      {tailFailed && <SectionLoadError message="Auto-update failed. Retrying in 30 seconds." />}
      {edges.length === 0 ? (
        isPending ? (
          <DeviceLogsRowsSkeleton dayHeader />
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
              <div className={DEVICE_LOG_DAY_HEADER}>
                <h3 className="uppercase text-ods-text-secondary text-h5">{formatDate(day.date)}</h3>
                <span aria-hidden="true" className="h-px flex-1 bg-ods-border" />
              </div>
              <ul className="flex flex-col gap-[var(--spacing-system-xxs)]">
                {day.rows.map(row => (
                  <DeviceLogRow
                    key={row.key}
                    entry={row.item.node}
                    deviceHostname={deviceHostname}
                    selected={row.key === selectedKey}
                    onSelect={entry => onSelect(row.key, entry)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      <div ref={bottomRef} aria-hidden="true" className="h-px" />
      {isLoadingNext && <DeviceLogsRowsSkeleton rows={3} />}
      {loadMoreFailed && <SectionLoadError message="Couldn't load older logs." onRetry={fetchNextPage} />}
      {edges.length > 0 && !hasNext && (
        <p className="py-[var(--spacing-system-s)] text-center text-ods-text-secondary text-h6">
          No older logs in this range
        </p>
      )}
    </div>
  );
}
