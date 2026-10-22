'use client';

import { ClipboardListIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { LoadingItems, LoadingWhen, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { useCallback, useMemo, useState } from 'react';
import { fetchQuery, graphql, useLazyLoadQuery, usePaginationFragment, useRelayEnvironment } from 'react-relay';
import type { deviceLogsList_query$key } from '@/__generated__/deviceLogsList_query.graphql';
import type { deviceLogsListPaginationQuery } from '@/__generated__/deviceLogsListPaginationQuery.graphql';
import type { deviceLogsListQuery, deviceLogsListQuery$variables } from '@/__generated__/deviceLogsListQuery.graphql';
import { noop, SectionLoadError, useRetryKey } from '@/app/components/shared';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import { useDeviceLogsLiveTail } from '../../../hooks/use-device-logs-live-tail';
import { useGridInfiniteScroll } from '../../../hooks/use-grid-infinite-scroll';
import { useIsAtTop } from '../../../hooks/use-is-at-top';
import { groupByLocalDay } from '../../../utils/device-log-time';
import { TabEmptyState } from '../tab-empty-state';
import { DEVICE_LOG_LIST_CLASS, DEVICE_LOG_SENTINEL_CLASS } from './device-log-layout';
import { DeviceLogDayGroup, type DeviceLogEntry, DeviceLogRow } from './device-log-row';

const PAGE_SIZE = 100;

export type DeviceLogsFilter = NonNullable<deviceLogsListQuery$variables['filter']>;

// `machineIds` / `organizationIds` omitted (null) is every device / every customer
// in the tenant; an empty list is a request the API rejects, so callers hand over
// undefined instead of [].
const deviceLogsListQueryNode = graphql`
  query deviceLogsListQuery(
    $machineIds: [String!]
    $organizationIds: [String!]
    $filter: DeviceLogFilterInput
    $first: Int!
    $after: String
  ) {
    ...deviceLogsList_query
      @arguments(
        machineIds: $machineIds
        organizationIds: $organizationIds
        filter: $filter
        first: $first
        after: $after
      )
  }
`;

// Keyed on the devices, the customers and the filter: cursors belong to the filter that made them.
const deviceLogsListFragment = graphql`
  fragment deviceLogsList_query on Query
  @refetchable(queryName: "deviceLogsListPaginationQuery")
  @argumentDefinitions(
    machineIds: { type: "[String!]" }
    organizationIds: { type: "[String!]" }
    filter: { type: "DeviceLogFilterInput" }
    first: { type: "Int!" }
    after: { type: "String" }
  ) {
    deviceLogs(
      machineIds: $machineIds
      organizationIds: $organizationIds
      filter: $filter
      first: $first
      after: $after
    ) @connection(key: "deviceLogsList_deviceLogs", filters: ["machineIds", "organizationIds", "filter"]) {
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
  /** The devices to read, 1-50; omitted = every device in the tenant. Never an empty list. */
  machineIds?: readonly string[];
  /** The customers to read, 1-50, intersected with `machineIds`; omitted = every customer. Never an empty list. */
  organizationIds?: readonly string[];
  filter: DeviceLogsFilter;
  /** The one device the list belongs to; omitted on a multi-device list — see `DeviceLogRow`. */
  deviceHostname?: string;
  /** The rows lag the controls while a filter change is in flight. */
  isPending: boolean;
  autoUpdate: boolean;
  hasFilters: boolean;
  onResetFilters: () => void;
  /** The empty state's second line; the default speaks of the range and filters. */
  emptyDescription?: string;
  /** The row open in the Log Details drawer, by its cursor. */
  selectedKey: string | null;
  onSelect: (key: string, entry: DeviceLogEntry) => void;
}

/**
 * A page of lines not read yet, one per row the page holds: each row (and the day heading the live list opens each
 * day with) draws its own loading form. `dayHeader` is on for a list's first page, off for the page a scroll appends
 * under one drawn.
 */
function DeviceLogsLoadingPage({ dayHeader = false }: { dayHeader?: boolean }) {
  return (
    <LoadingWhen loading>
      <DeviceLogDayGroup date={dayHeader ? null : undefined}>
        <LoadingItems count={PAGE_SIZE}>
          {() => <DeviceLogRow entry={null} selected={false} onSelect={noop} />}
        </LoadingItems>
      </DeviceLogDayGroup>
    </LoadingWhen>
  );
}

/**
 * The list, newest first, grouped by local day; older pages on scroll, the head re-read by the live tail. Remounted
 * per filter. In a loading scope (the device has not answered, or the Suspense fallback) it draws its first page's
 * loading form under the live list's top sentinel, and runs no query.
 */
export function DeviceLogsList(props: DeviceLogsListProps) {
  if (useLoadingScope()) {
    return (
      <div className={DEVICE_LOG_LIST_CLASS}>
        <div aria-hidden="true" className={DEVICE_LOG_SENTINEL_CLASS} />
        <DeviceLogsLoadingPage dayHeader />
      </div>
    );
  }
  return <DeviceLogsListQuery {...props} />;
}

function DeviceLogsListQuery({
  machineIds,
  organizationIds,
  filter,
  deviceHostname,
  isPending,
  autoUpdate,
  hasFilters,
  onResetFilters,
  emptyDescription = 'Nothing matched the current range and filters.',
  selectedKey,
  onSelect,
}: DeviceLogsListProps) {
  const environment = useRelayEnvironment();
  const { toast } = useToast();
  const retryKey = useRetryKey();
  const variables = useMemo(
    () => ({
      machineIds: machineIds ?? null,
      organizationIds: organizationIds ?? null,
      filter,
      first: PAGE_SIZE,
      after: null,
    }),
    [machineIds, organizationIds, filter],
  );
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
    // Not while the next list is on its way: an older page of these rows is a Loki scan nobody will see.
    enabled: edges.length > 0 && !loadMoreFailed && !isPending,
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
    <div className={DEVICE_LOG_LIST_CLASS}>
      <div ref={topRef} aria-hidden="true" className={DEVICE_LOG_SENTINEL_CLASS} />
      {tailFailed && <SectionLoadError message="Auto-update failed. Retrying in 30 seconds." />}
      {edges.length === 0 ? (
        isPending ? (
          <DeviceLogsLoadingPage dayHeader />
        ) : (
          <TabEmptyState
            icon={<ClipboardListIcon />}
            title="No logs in this range"
            description={emptyDescription}
            buttonLabel={hasFilters ? 'Reset filters' : undefined}
            onButtonClick={hasFilters ? onResetFilters : undefined}
          />
        )
      ) : (
        <div
          aria-busy={isPending || isLoadingNext}
          className={cn(
            DEVICE_LOG_LIST_CLASS,
            'transition-opacity motion-reduce:transition-none',
            // The dim waits half a second, and lifts at once: a fast answer swaps the rows without a flash.
            isPending && 'opacity-60 delay-500',
          )}
        >
          {days.map(day => (
            <DeviceLogDayGroup key={day.key} date={day.date}>
              {day.rows.map(row => (
                <DeviceLogRow
                  key={row.key}
                  entry={row.item.node}
                  deviceHostname={deviceHostname}
                  selected={row.key === selectedKey}
                  onSelect={entry => onSelect(row.key, entry)}
                />
              ))}
            </DeviceLogDayGroup>
          ))}
        </div>
      )}
      <div ref={bottomRef} aria-hidden="true" className={DEVICE_LOG_SENTINEL_CLASS} />
      {isLoadingNext && <DeviceLogsLoadingPage />}
      {loadMoreFailed && <SectionLoadError message="Couldn't load older logs." onRetry={fetchNextPage} />}
      {edges.length > 0 && !hasNext && (
        <p className="py-[var(--spacing-system-s)] text-center text-ods-text-secondary text-h6">
          No older logs in this range
        </p>
      )}
    </div>
  );
}
