'use client';

import { ToolBadge } from '@flamingo-stack/openframe-frontend-core';
import {
  getDeviceName,
  LogDrawer,
  logSeverityVariant,
  logSourceLabels,
  LogsPageView,
  type LogsTableFacets,
  LogsTableView,
  type UiLogEntry,
} from '@flamingo-stack/openframe-frontend-core/components/features';
import type { DateFilterResult, DateRange } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useApiParams, useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { normalizeToolTypeWithFallback, toToolLabel } from '@flamingo-stack/openframe-frontend-core/utils';
import {
  forwardRef,
  Suspense,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';
import { graphql, useLazyLoadQuery, usePaginationFragment } from 'react-relay';
import type {
  logsTableRelay_query$data as LogsFragmentData,
  logsTableRelay_query$key as LogsFragmentKey,
} from '@/__generated__/logsTableRelay_query.graphql';
import type { logsTableRelayPaginationQuery as LogsPaginationQueryType } from '@/__generated__/logsTableRelayPaginationQuery.graphql';
import type { logsTableRelayQuery as LogsQueryType } from '@/__generated__/logsTableRelayQuery.graphql';
import {
  DateColumnHeader,
  EMBEDDED_PAGE_OFFSET,
  EmptyState,
  type EmptyStateProps,
  onboardingGuideButton,
  type TableDateFilter,
  useRetryKey,
} from '@/app/components/shared';
import { logDrawerDeviceCard } from '@/app/components/shared/log-drawer-device-card';
import { useQueuedParamsWrite } from '@/app/hooks/use-queued-params-write';
import { useSearchParam } from '@/app/hooks/use-search-param';
import { LogSortField, SortDirection } from '@/generated/schema-enums';
import { dateRangeFromParams, dateRangeToInstantBounds, toDayParam } from '@/lib/date-filter-params';
import { EMPTY_VALUE } from '@/lib/empty-value';
import { transformOrganizationFilters } from '@/lib/filter-utils';
import { formatDateTime } from '@/lib/format-date';
import { routes } from '@/lib/routes';
import { LogCopyButton } from './log-copy-button';
import { LogDrawerDetails } from './log-drawer-details';
import { LogsTableSkeleton } from './logs-table-skeleton';

// ----------------------------------------------------------------
// GraphQL definitions
// ----------------------------------------------------------------

const LOGS_PAGE_SIZE = 20;

const logsTableRelayQuery = graphql`
  query logsTableRelayQuery(
    $filter: LogFilterInput
    $first: Int!
    $after: String
    $search: String
    $sort: LogSortInput
  ) {
    ...logsTableRelay_query @arguments(filter: $filter, first: $first, after: $after, search: $search, sort: $sort)
    logFilters(filter: $filter) {
      toolTypes
      severities
      organizations {
        id
        name
      }
    }
  }
`;

const logsTableRelayFragment = graphql`
  fragment logsTableRelay_query on Query
  @refetchable(queryName: "logsTableRelayPaginationQuery")
  @argumentDefinitions(
    filter: { type: "LogFilterInput" }
    first: { type: "Int", defaultValue: 20 }
    after: { type: "String" }
    search: { type: "String" }
    sort: { type: "LogSortInput" }
  ) {
    logs(filter: $filter, first: $first, after: $after, search: $search, sort: $sort)
      @connection(key: "logsTableRelay_logs") {
      edges {
        node {
          id
          toolEventId
          eventType
          ingestDay
          toolType
          severity
          deviceId
          hostname
          nickname
          organizationId
          organizationName
          summary
          timestamp
          ...logCopyButton_log
          ...logDrawerDetails_log
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

type UiSortDirection = 'asc' | 'desc';

type LogFilterInput = NonNullable<LogsQueryType['variables']['filter']>;
type LogSortInput = NonNullable<LogsQueryType['variables']['sort']>;
/** A row of the connection as the fragment above selects it. */
type LogNode = LogsFragmentData['logs']['edges'][number]['node'];

/** A table row plus the API row it was built from. */
interface LogRow extends UiLogEntry {
  /**
   * The row shape drops what the details link still needs (the composite key
   * `ingestDay`/`toolType`/`eventType`/`timestamp`, and the device id), and the
   * copy button and the drawer read their own fragments off it, so the source
   * row rides along.
   */
  originalLogEntry: LogNode;
}

interface LogsTableProps {
  deviceId?: string;
  /** Lock the table to a single organization. When set, the source/organization column filter is hidden. */
  organizationId?: string;
  /** Render inside a tab (e.g. customer/device details) — drops the standalone top padding. */
  embedded?: boolean;
  /** Render the PageLayout header (title + Refresh action). Defaults to `true`. Pass
   *  `false` when embedded in a section that supplies its own heading (e.g. the device
   *  Overview tab), so only the search toolbar + table show. */
  showHeader?: boolean;
}

export interface LogsTableRef {
  refresh: () => void;
}

interface LogsTableContentProps {
  deviceId?: string;
  organizationLocked?: boolean;
  backendFilters: LogFilterInput;
  sort: LogSortInput;
  /** Applied date filter (Log ID column) — drives the header calendar popover */
  dateFilter: TableDateFilter;
  debouncedSearch: string;
  tableFilters: Record<string, string[]>;
  onFilterChange: (filters: Record<string, string[]>) => void;
  onRefreshRef: React.RefObject<(() => void) | null>;
  /** Reports the genuinely-empty (onboarding) state up so the outer layout can
   *  hide the search field while the empty state is shown. */
  onEmptyChange: (isEmpty: boolean) => void;
  /** Mobile filter modal open state (the trigger lives in the outer toolbar, but
   *  the filter options come from this component's logFilters query). */
  mobileFilterOpen: boolean;
  onMobileFilterClose: () => void;
}

const LOGS_GUIDE_BUTTON = onboardingGuideButton('logs');

const renderEmptyState = (props: EmptyStateProps) => <EmptyState {...props} />;

const renderCopyAction = (log: LogRow) => <LogCopyButton log={log.originalLogEntry} />;

// ----------------------------------------------------------------
// Inner content — uses Relay hooks, must be inside Suspense
// ----------------------------------------------------------------

function LogsTableContent({
  deviceId,
  organizationLocked,
  backendFilters,
  sort,
  dateFilter,
  debouncedSearch,
  tableFilters,
  onFilterChange,
  onRefreshRef,
  onEmptyChange,
  mobileFilterOpen,
  onMobileFilterClose,
}: LogsTableContentProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [selectedLog, setSelectedLog] = useState<LogRow | null>(null);

  const retryKey = useRetryKey();
  const queryData = useLazyLoadQuery<LogsQueryType>(
    logsTableRelayQuery,
    {
      filter: backendFilters,
      first: LOGS_PAGE_SIZE,
      after: null,
      search: debouncedSearch || null,
      sort,
    },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );

  const { data, loadNext, hasNext, isLoadingNext, refetch } = usePaginationFragment<
    LogsPaginationQueryType,
    LogsFragmentKey
  >(logsTableRelayFragment, queryData);

  const facets = useMemo<LogsTableFacets | null>(
    () =>
      queryData.logFilters
        ? {
            toolTypes: queryData.logFilters.toolTypes,
            severities: queryData.logFilters.severities,
            organizations: transformOrganizationFilters(
              queryData.logFilters.organizations.map(org => ({ id: org.id, name: org.name })),
            ),
          }
        : null,
    [queryData.logFilters],
  );

  const logs = useMemo(() => {
    const edges = data.logs?.edges ?? [];
    return edges.map(edge => {
      const node = edge.node;
      return {
        ...node,
        device:
          node.deviceId || node.hostname || node.organizationName
            ? {
                id: node.deviceId || '',
                machineId: node.deviceId || '',
                hostname: node.hostname || node.deviceId || '',
                nickname: node.nickname ?? undefined,
                organizationId: node.organizationId,
                organization: node.organizationName || node.organizationId || '',
              }
            : undefined,
      };
    });
  }, [data.logs?.edges]);

  const fetchNextPage = useCallback(() => {
    if (hasNext && !isLoadingNext) {
      loadNext(LOGS_PAGE_SIZE, {
        onComplete: err => {
          if (err) {
            toast({
              title: 'Error loading more logs',
              description: err.message,
              variant: 'destructive',
            });
          }
        },
      });
    }
  }, [hasNext, isLoadingNext, loadNext, toast]);

  const resetToFirstPage = useCallback(() => {
    startTransition(() => {
      refetch(
        {
          filter: backendFilters,
          first: LOGS_PAGE_SIZE,
          after: null,
          search: debouncedSearch || null,
          sort,
        },
        { fetchPolicy: 'network-only' },
      );
    });
  }, [refetch, backendFilters, debouncedSearch, sort]);

  // Expose refresh to parent via mutable ref
  // Latest-value refs, written after the commit rather than during render:
  // a render-phase ref write is what `react-hooks/refs` forbids, and every
  // reader below runs in an effect, a timer or an event handler.
  useEffect(() => {
    onRefreshRef.current = resetToFirstPage;
  });

  const transformedLogs: LogRow[] = useMemo(() => {
    return logs.map(log => ({
      id: log.toolEventId,
      logId: log.toolEventId,
      timestamp: formatDateTime(log.timestamp),
      status: { label: log.severity, variant: logSeverityVariant(log.severity) },
      source: {
        name: toToolLabel(log.toolType),
        toolType: normalizeToolTypeWithFallback(log.toolType),
      },
      device: {
        name: getDeviceName(log.device) || log.hostname || log.deviceId || EMPTY_VALUE,
        organization: log.device?.organization || log.organizationName || EMPTY_VALUE,
      },
      description: {
        title: log.summary || 'No summary available',
      },
      originalLogEntry: log,
    }));
  }, [logs]);

  const getLogDetailsUrl = useCallback((log: LogRow): string => {
    const original = log.originalLogEntry;
    const id = log.id || log.logId;
    return routes.logs.details(id, {
      ingestDay: original.ingestDay,
      toolType: original.toolType,
      eventType: original.eventType,
      timestamp: original.timestamp,
    });
  }, []);

  // Log ID header: label + calendar popover with timestamp sort + date-range
  // filter, the same control every other date-filtered list renders.
  const logIdHeader = useMemo(() => <DateColumnHeader label="Log ID" filter={dateFilter} />, [dateFilter]);

  const handleCloseModal = useCallback(() => {
    setSelectedLog(null);
  }, []);

  return (
    <>
      <LogsTableView<LogRow>
        logs={transformedLogs}
        loading={isPending}
        facets={facets}
        filters={tableFilters}
        onFilterChange={onFilterChange}
        search={debouncedSearch}
        dateFilter={dateFilter}
        logIdHeader={logIdHeader}
        deviceScoped={Boolean(deviceId)}
        organizationLocked={organizationLocked}
        getLogHref={getLogDetailsUrl}
        renderCopyAction={renderCopyAction}
        onQuickView={setSelectedLog}
        hasNextPage={hasNext}
        isFetchingNextPage={isLoadingNext}
        onLoadMore={fetchNextPage}
        mobileFilterOpen={mobileFilterOpen}
        onMobileFilterClose={onMobileFilterClose}
        onHideSearchChange={onEmptyChange}
        renderEmptyState={renderEmptyState}
        guideButton={LOGS_GUIDE_BUTTON}
      />

      <LogDrawer
        isOpen={Boolean(selectedLog)}
        onClose={handleCloseModal}
        description={
          selectedLog ? (
            <LogDrawerDetails log={selectedLog.originalLogEntry} fallback={selectedLog.description.title} />
          ) : (
            ''
          )
        }
        statusTag={selectedLog?.status}
        timestamp={selectedLog?.timestamp}
        // The card's Details button closes the drawer on the way out: this
        // table is embedded in the device detail page itself (overview tab),
        // where the button's target is the very URL already open. On mobile the
        // drawer is full-bleed, so it would hide the page it just went to.
        deviceCard={logDrawerDeviceCard(selectedLog?.originalLogEntry.deviceId ?? undefined, handleCloseModal)}
        infoFields={
          selectedLog
            ? [
                { label: 'Log ID', value: selectedLog.logId },
                {
                  label: 'Source',
                  value: <ToolBadge toolType={normalizeToolTypeWithFallback(selectedLog.source.toolType)} />,
                },
                { label: 'Device', value: logSourceLabels(selectedLog.device).deviceName },
              ]
            : []
        }
      />
    </>
  );
}

// ----------------------------------------------------------------
// Outer component — layout shell with internal Suspense
// ----------------------------------------------------------------

export const LogsTable = forwardRef<LogsTableRef, LogsTableProps>(function LogsTableImpl(
  { deviceId, organizationId, embedded, showHeader }: LogsTableProps,
  ref,
) {
  const { params, setParam, setParams } = useApiParams({
    search: { type: 'string', default: '' },
    severities: { type: 'array', default: [] },
    toolTypes: { type: 'array', default: [] },
    organizationIds: { type: 'array', default: [] },
    dateFrom: { type: 'string', default: '' },
    dateTo: { type: 'string', default: '' },
    sortDirection: { type: 'string', default: 'desc' },
  });

  // Local search input keeps typing responsive; the debounced value drives both
  // the query and the URL param (so history isn't spammed on every keystroke).
  // The shared hook guards the back/forward sync-down so it can't clobber
  // characters typed while a fetch is in flight.
  const {
    search: searchInput,
    setSearch: setSearchInput,
    debouncedSearch,
  } = useSearchParam(params.search, value => setParam('search', value), 300);

  // Whether the inner content is in the genuinely-empty onboarding state; when
  // true the search toolbar is hidden (the header + actions stay).
  const [isEmpty, setIsEmpty] = useState(false);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  const lockedOrgIds = useMemo(() => (organizationId ? [organizationId] : undefined), [organizationId]);

  // Applied date filter (Log ID column) restored from the URL
  const dateRange: DateRange | undefined = useMemo(
    () => dateRangeFromParams(params.dateFrom, params.dateTo),
    [params.dateFrom, params.dateTo],
  );

  const sortDirection: UiSortDirection = params.sortDirection === 'asc' ? 'asc' : 'desc';

  const sort: LogSortInput = useMemo(
    () => ({
      field: LogSortField.TIMESTAMP,
      direction: sortDirection === 'asc' ? SortDirection.ASC : SortDirection.DESC,
    }),
    [sortDirection],
  );

  const backendFilters: LogFilterInput = useMemo(() => {
    const bounds = dateRangeToInstantBounds(dateRange);
    return {
      severities: params.severities,
      toolTypes: params.toolTypes,
      organizationIds: lockedOrgIds ?? params.organizationIds,
      deviceId,
      timestampFrom: bounds.from,
      timestampTo: bounds.to,
    };
  }, [params.severities, params.toolTypes, params.organizationIds, deviceId, lockedOrgIds, dateRange]);

  // The mobile FilterModal commits the group filters and the date filter as two
  // callbacks in the same tick; the shared writer merges them into one URL write
  // (sequential setParams calls each re-read the stale URL and clobber).
  const queueParamsWrite = useQueuedParamsWrite(setParams);

  const handleDateFilterApply = useCallback(
    (result: DateFilterResult) => {
      queueParamsWrite({
        // Default direction stays out of the URL
        sortDirection: result.sort === 'desc' ? '' : result.sort,
        dateFrom: result.range?.from ? toDayParam(result.range.from) : '',
        dateTo: result.range?.to ? toDayParam(result.range.to) : '',
      });
    },
    [queueParamsWrite],
  );

  const dateFilter: TableDateFilter = useMemo(
    () => ({ sortDirection, range: dateRange, onApply: handleDateFilterApply }),
    [sortDirection, dateRange, handleDateFilterApply],
  );

  const tableFilters = useMemo(
    () => ({
      status: params.severities,
      tool: params.toolTypes,
      source: lockedOrgIds ? [] : params.organizationIds,
    }),
    [params.severities, params.toolTypes, params.organizationIds, lockedOrgIds],
  );

  const handleFilterChange = useCallback(
    (columnFilters: Record<string, string[]>) => {
      queueParamsWrite({
        severities: columnFilters.status || [],
        toolTypes: columnFilters.tool || [],
        organizationIds: columnFilters.source || [],
      });
    },
    [queueParamsWrite],
  );

  // Mutable ref so inner component can expose refresh without re-renders
  const refreshRef = useRef<(() => void) | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      refresh: () => refreshRef.current?.(),
    }),
    [],
  );

  const handleRefresh = useCallback(() => {
    refreshRef.current?.();
  }, []);

  return (
    <LogsPageView
      onRefresh={handleRefresh}
      showHeader={showHeader}
      className={embedded ? EMBEDDED_PAGE_OFFSET : undefined}
      // The search toolbar sits outside the Suspense boundary so it keeps focus
      // across re-queries, and hides while the empty state is shown.
      search={searchInput}
      onSearchChange={setSearchInput}
      hideSearch={isEmpty}
      onOpenFilters={() => setMobileFilterOpen(true)}
    >
      <Suspense fallback={<LogsTableSkeleton />}>
        <LogsTableContent
          deviceId={deviceId}
          organizationLocked={Boolean(organizationId)}
          backendFilters={backendFilters}
          sort={sort}
          dateFilter={dateFilter}
          debouncedSearch={debouncedSearch}
          tableFilters={tableFilters}
          onFilterChange={handleFilterChange}
          onRefreshRef={refreshRef}
          onEmptyChange={setIsEmpty}
          mobileFilterOpen={mobileFilterOpen}
          onMobileFilterClose={() => setMobileFilterOpen(false)}
        />
      </Suspense>
    </LogsPageView>
  );
});
LogsTable.displayName = 'LogsTable';
