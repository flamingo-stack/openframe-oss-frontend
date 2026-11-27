'use client';

import { ToolBadge } from '@flamingo-stack/openframe-frontend-core';
import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
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
import {
  AutoRefreshControl,
  type DateFilterResult,
  type DateRange,
  LoadError,
  LoadingWhen,
  type TableMetaRow,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import {
  CURSOR_PAGER_KEYS,
  type CursorPagerVariables,
  useApiParams,
  useCursorPager,
  type UseCursorPagerReturn,
  useToast,
} from '@flamingo-stack/openframe-frontend-core/hooks';
import { normalizeToolTypeWithFallback, toToolLabel } from '@flamingo-stack/openframe-frontend-core/utils';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type {
  logsTableRelayQuery$data as LogsQueryData,
  logsTableRelayQuery as LogsQueryType,
} from '@/__generated__/logsTableRelayQuery.graphql';
import {
  ContentErrorBoundary,
  DateColumnHeader,
  EMBEDDED_PAGE_OFFSET,
  EmptyState,
  type EmptyStateProps,
  NO_ITEMS,
  onboardingGuideButton,
  type TableDateFilter,
  useRetryKey,
} from '@/app/components/shared';
import { PendingDim } from '@/app/components/shared/live-table';
import { logDrawerDeviceCard } from '@/app/components/shared/log-drawer-device-card';
import { readCursor, StaleCursorBoundary } from '@/app/components/shared/stale-cursor-boundary';
import { forwardPage } from '@/app/hooks/forward-page';
import { useDeferredQuery } from '@/app/hooks/use-deferred-query';
import { usePagedTable } from '@/app/hooks/use-paged-table';
import { useQueuedParamsWrite } from '@/app/hooks/use-queued-params-write';
import { useRefetchPage } from '@/app/hooks/use-refetch-page';
import { useSearchParam } from '@/app/hooks/use-search-param';
import { type TableLayout, tableLayoutFor, useTableGridGate } from '@/app/hooks/use-table-layout';
import { LogSortField, SortDirection } from '@/generated/schema-enums';
import { dateRangeFromParams, dateRangeToInstantBounds, toDayParam } from '@/lib/date-filter-params';
import { EMPTY_VALUE } from '@/lib/empty-value';
import { transformOrganizationFilters } from '@/lib/filter-utils';
import { formatDateTime } from '@/lib/format-date';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import { PAGED_LISTS } from '@/lib/paged-lists';
import { loadErrorProps } from '@/lib/query-state';
import { routes } from '@/lib/routes';
import { LOGS_PAGE_SIZE } from '../hooks/use-logs';
import { LogCopyButton } from './log-copy-button';
import { LogDrawerDetails } from './log-drawer-details';
import { type LogsTablePlace, logsTablePlace, logsTableSettings } from './logs-table-settings';

// ----------------------------------------------------------------
// GraphQL definitions
// ----------------------------------------------------------------

/** The Log ID header before the rows land: the same header, inert (no calendar to act on yet). */
const INERT_LOG_ID_HEADER = <DateColumnHeader label="Log ID" />;

/**
 * One page of logs per request, its cursor in the URL (no `@connection`: a cursor from a link must read exactly its
 * page). `logs` accepts `last` / `before` but answers the NEXT page to them, so the query declares neither: it pages
 * forward only (`first` / `after`, `PAGED_LISTS.logs`). Logs carry no total: the range reads "21–40 logs".
 *
 * The filter facets (`logFilters`) ride the same operation: a page move asks for them again with the same filter (the
 * same answer).
 */
const logsTableRelayQuery = graphql`
  query logsTableRelayQuery(
    $filter: LogFilterInput
    $first: Int!
    $after: String
    $search: String
    $sort: LogSortInput
  ) {
    logs(filter: $filter, first: $first, after: $after, search: $search, sort: $sort) {
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
        hasPreviousPage
        startCursor
        endCursor
      }
    }
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

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

type UiSortDirection = 'asc' | 'desc';

type LogFilterInput = NonNullable<LogsQueryType['variables']['filter']>;
type LogSortInput = NonNullable<LogsQueryType['variables']['sort']>;
/** A row of the page as the query above selects it. */
type LogNode = LogsQueryData['logs']['edges'][number]['node'];

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
  /**
   * The table shows one device's logs (no Device column). Defaults to `Boolean(deviceId)`; pass it when the
   * device id is not known yet (a device tab drawn in its page's loading scope) so the loading and loaded
   * tables have the same columns.
   */
  deviceScoped?: boolean;
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
  /** Read the newest logs: the first page (a later page's cursor is dropped), from the network. */
  refresh: () => void;
}

/**
 * The table's URL prefix where it is drawn. On the Logs page the table owns the query string: no prefix. In a device's
 * Overview and a customer's Logs tab it shares the page's query string with the other tabs' tables (a customer's
 * Devices tab has a `search` of its own), so its search, filters, date range, sort and pager sit under `logs…`
 * (`logsSearch`, `logsSeverities`, `logsToolTypes`, `logsOrganizationIds`, `logsDateFrom`, `logsDateTo`,
 * `logsSortDirection`, `logsCursor`, `logsPage`, `logsRefresh`).
 */
function logsParamPrefix(place: LogsTablePlace): string | undefined {
  return place === 'page' ? undefined : 'logs';
}

interface LogsTableContentProps {
  deviceScoped: boolean;
  organizationLocked?: boolean;
  /** Deferred — the URL's filters, as `logs(filter:)` takes them. */
  backendFilters: LogFilterInput;
  /** Deferred — the URL's sort direction (TIMESTAMP is the one sort field). */
  sort: LogSortInput;
  /** Applied date filter (Log ID column) — drives the header calendar popover */
  dateFilter: TableDateFilter;
  /** Deferred — the URL's search (never the box's: see `LogsTable`). */
  search: string;
  tableFilters: Record<string, string[]>;
  onFilterChange: (filters: Record<string, string[]>) => void;
  /** Where the table puts the refetch of the page on screen, for Refresh on the first page. */
  onRefreshRef: React.RefObject<(() => void) | null>;
  /** Reports the genuinely-empty (onboarding) state up so the outer layout can
   *  hide the search field while the empty state is shown. */
  onEmptyChange: (isEmpty: boolean) => void;
  /** Mobile filter modal open state (the trigger lives in the outer toolbar, but
   *  the filter options come from this component's logFilters query). */
  mobileFilterOpen: boolean;
  onMobileFilterClose: () => void;
  /** In a loading scope (an embedding tab whose parent still loads) the table reads nothing. */
  scoped: boolean;
  /** The table the `data-table-grid` flag picks. */
  tableLayout: TableLayout;
  /** Where the table is drawn: its saved grid layout, and whether it fills the page's height. */
  place: LogsTablePlace;
  /**
   * A deferred value lags the URL: the rows on screen are the previous result (dimmed, the pager waiting), never
   * swapped for the loading rows.
   */
  isPending: boolean;
  /** The list's position in the URL: footer props, the stale check, the cursor drop. */
  pager: UseCursorPagerReturn;
  /** Deferred — the page variables to spread into the query (lag the URL while the next page is read). */
  pageVariables: CursorPagerVariables;
  /** The table's URL prefix (`logsParamPrefix`): its auto-refresh interval sits beside its other params. */
  paramPrefix: string | undefined;
}

/**
 * The grid table's height and settings for where it is drawn. On the Logs page the table is the page's main content:
 * it takes the height the page leaves and scrolls inside itself. In a device's or a customer's tab it is a section of
 * a page that scrolls, so it states no height. A cards table reads neither.
 */
function tableLayoutProps(tableLayout: TableLayout, place: LogsTablePlace) {
  return {
    layout: tableLayout,
    tableMaxHeight: place === 'page' ? ('fill' as const) : undefined,
    tableSettings: logsTableSettings(place),
  };
}

const LOGS_GUIDE_BUTTON = onboardingGuideButton('logs');

const LOAD_ERROR_MESSAGE = "Couldn't load logs.";

/** The row above the table while the first page is read: the pager drawn, waiting. */
const LOADING_META_ROW: TableMetaRow = { pager: null };

const renderEmptyState = (props: EmptyStateProps) => <EmptyState {...props} />;

const renderCopyAction = (log: LogRow) => <LogCopyButton log={log.originalLogEntry} />;
/** The grid table's copy action: the bare button, the action cell being its frame. */
const renderGridCopyAction = (log: LogRow) => <LogCopyButton log={log.originalLogEntry} grid />;

// ----------------------------------------------------------------
// Inner content — uses Relay hooks, inside its own boundary
// ----------------------------------------------------------------

/**
 * The logs table, with its own boundary: in its scope the reader draws its own loading form. A cursor the server
 * refuses drops to the first page (`StaleCursorBoundary`); any other error goes up unchanged.
 */
function LogsTableContent(props: LogsTableContentProps) {
  return (
    <StaleCursorBoundary cursor={readCursor(props.pageVariables)} onStaleCursor={props.pager.dropCursor}>
      <LogsTableContentLoading {...props} />
    </StaleCursorBoundary>
  );
}

/** The rows' loading boundary, the whole output of its own component (the loading standard), under the
 * stale-cursor boundary above. */
function LogsTableContentLoading(props: LogsTableContentProps) {
  return (
    <LoadingSuspense bare gated={props.scoped} label="Loading logs">
      <LogsTableContentReader {...props} />
    </LoadingSuspense>
  );
}

function LogsTableContentReader(props: LogsTableContentProps) {
  // In a loading scope (its boundary's fallback while the first page is in flight, or an outer loading state) it reads
  // nothing: the same table view draws its own loading rows, the pager drawn, waiting.
  if (useLoadingScope()) {
    return (
      <LogsTableView<LogRow>
        logs={NO_ITEMS}
        loading
        filters={props.tableFilters}
        onFilterChange={props.onFilterChange}
        search={props.search}
        dateFilter={props.dateFilter}
        logIdHeader={INERT_LOG_ID_HEADER}
        deviceScoped={props.deviceScoped}
        organizationLocked={Boolean(props.organizationLocked)}
        pageSize={LOGS_PAGE_SIZE}
        metaRow={LOADING_META_ROW}
        {...tableLayoutProps(props.tableLayout, props.place)}
      />
    );
  }
  return <LogsTableContentLive {...props} />;
}

/** The page the URL names, its pager and the auto-refresh, through the lib view's row above the table. */
function LogsTableContentLive({
  deviceScoped,
  organizationLocked,
  backendFilters,
  sort,
  dateFilter,
  search,
  tableFilters,
  onFilterChange,
  onRefreshRef,
  onEmptyChange,
  mobileFilterOpen,
  onMobileFilterClose,
  tableLayout,
  place,
  isPending,
  pager,
  pageVariables,
  paramPrefix,
}: LogsTableContentProps) {
  const { toast } = useToast();
  const [selectedLog, setSelectedLog] = useState<LogRow | null>(null);
  // Refresh on the first page is out: the rows on screen dim and the pager waits until the answer is in.
  const [refreshing, setRefreshing] = useState(false);

  const retryKey = useRetryKey();
  const variables: LogsQueryType['variables'] = {
    filter: backendFilters,
    search: search || null,
    sort,
    ...forwardPage(pageVariables, LOGS_PAGE_SIZE),
  };
  const queryData = useLazyLoadQuery<LogsQueryType>(logsTableRelayQuery, variables, {
    fetchPolicy: 'store-and-network',
    fetchKey: retryKey,
  });
  const refetch = useRefetchPage<LogsQueryType>(logsTableRelayQuery, variables);
  const { edges, pageInfo } = queryData.logs;
  const paged = usePagedTable({ pager, pageInfo, rowCount: edges.length, prefix: paramPrefix, refetch, isPending });

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

  const logs = useMemo(
    () =>
      edges.map(edge => {
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
      }),
    [edges],
  );

  // Refresh on the first page: the page on screen from the network. A failure keeps the rows and toasts, where a
  // failed render-time read would swap the table for the error card.
  const refreshPage = () => {
    setRefreshing(true);
    refetch()
      .catch((error: Error) => {
        toast({
          title: 'Error',
          description: getRelayErrorMessage(error, "Couldn't refresh logs"),
          variant: 'destructive',
        });
      })
      .finally(() => setRefreshing(false));
  };

  // Expose the refetch to the parent via a mutable ref. Latest-value ref, written after the commit rather than during
  // render: a render-phase ref write is what `react-hooks/refs` forbids, and its reader runs in an event handler.
  useEffect(() => {
    onRefreshRef.current = refreshPage;
    // A failed query unmounts this reader under the error boundary: leave no refetch behind for a refresh to call.
    return () => {
      onRefreshRef.current = null;
    };
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

  const metaRow: TableMetaRow = {
    pager: paged.pager,
    loading: isPending || refreshing,
    actions: <AutoRefreshControl {...paged.refresh} />,
  };

  return (
    <>
      <PendingDim isPending={isPending || refreshing}>
        <LogsTableView<LogRow>
          logs={transformedLogs}
          facets={facets}
          filters={tableFilters}
          onFilterChange={onFilterChange}
          search={search}
          dateFilter={dateFilter}
          logIdHeader={logIdHeader}
          deviceScoped={deviceScoped}
          organizationLocked={organizationLocked}
          getLogHref={getLogDetailsUrl}
          renderCopyAction={tableLayout === 'grid' ? renderGridCopyAction : renderCopyAction}
          onQuickView={setSelectedLog}
          metaRow={metaRow}
          mobileFilterOpen={mobileFilterOpen}
          onMobileFilterClose={onMobileFilterClose}
          onHideSearchChange={onEmptyChange}
          renderEmptyState={renderEmptyState}
          guideButton={LOGS_GUIDE_BUTTON}
          pageSize={LOGS_PAGE_SIZE}
          {...tableLayoutProps(tableLayout, place)}
        />
      </PendingDim>

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

/**
 * The logs table and its page around it (title, Refresh, search), one page at a time with First · Prev · Next.
 *
 * The search, the filters, the date range, the sort and the pager live in the URL (under `logs…` in a device's or a
 * customer's tab, see `logsParamPrefix`): a change to any of them drops the cursor in the SAME URL write (one history
 * entry on page 2+, so Back returns to the old view). The box keeps the typed search locally; the query reads the
 * URL's, so a search and a cursor from another narrowing never meet in one request.
 */
export const LogsTable = forwardRef<LogsTableRef, LogsTableProps>(function LogsTableImpl(
  { deviceId, deviceScoped = Boolean(deviceId), organizationId, embedded, showHeader }: LogsTableProps,
  ref,
) {
  const place = logsTablePlace({ deviceScoped, organizationLocked: Boolean(organizationId) });
  const paramPrefix = logsParamPrefix(place);
  const { params, setParam, setParams } = useApiParams(
    {
      search: { type: 'string', default: '' },
      severities: { type: 'array', default: [] },
      toolTypes: { type: 'array', default: [] },
      organizationIds: { type: 'array', default: [] },
      dateFrom: { type: 'string', default: '' },
      dateTo: { type: 'string', default: '' },
      sortDirection: { type: 'string', default: 'desc' },
    },
    { prefix: paramPrefix, resetKeys: CURSOR_PAGER_KEYS, resetHistory: 'push' },
  );
  // The safety net for a cursor issued under other filters: the URL's narrowing, sort included. Not the device or the
  // customer: they are the page's, and a device id that arrives after the first render must not drop a linked cursor.
  const pager = useCursorPager({
    prefix: paramPrefix,
    pageSize: LOGS_PAGE_SIZE,
    ...PAGED_LISTS.logs,
    resetOn: JSON.stringify(params),
  });

  // Local search input keeps typing responsive; the shared hook debounces it into the URL param (so history isn't
  // spammed on every keystroke) and guards the back/forward sync-down so it can't clobber characters typed while a
  // fetch is in flight.
  const { search: searchInput, setSearch: setSearchInput } = useSearchParam(
    params.search,
    value => setParam('search', value),
    300,
  );

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

  // Memoized for its identity, not for speed: `useDeferredQuery` tells a pending refetch by comparing references.
  const query = useMemo(() => {
    const bounds = dateRangeToInstantBounds(dateRange);
    const filter: LogFilterInput = {
      severities: params.severities,
      toolTypes: params.toolTypes,
      organizationIds: lockedOrgIds ?? params.organizationIds,
      deviceId,
      timestampFrom: bounds.from,
      timestampTo: bounds.to,
    };
    const sort: LogSortInput = {
      field: LogSortField.TIMESTAMP,
      direction: sortDirection === 'asc' ? SortDirection.ASC : SortDirection.DESC,
    };
    return { filter, sort };
  }, [params.severities, params.toolTypes, params.organizationIds, deviceId, lockedOrgIds, dateRange, sortDirection]);

  // Deferred variables, page included: a filter, search, sort or page change keeps the rows (and the search box, and
  // its focus) on screen, dimmed, while the next ones are read, instead of dropping the table to its fallback. The
  // query reads the URL's search: the write that carries a new search drops the cursor in the same navigation.
  const { deferredFilters, deferredSearch, deferredPage, isPending } = useDeferredQuery(
    query,
    params.search,
    pager.variables,
  );

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

  // The page on screen's refetch, put here by the table once it has read its page.
  const refreshRef = useRef<(() => void) | null>(null);

  // Refresh reads the newest logs: on a later page that is the first page, so the cursor goes (no history entry) and
  // the first page is read; on the first page, the page on screen from the network. Never a refetch with no cursor
  // under a later page's range: the rows would be page 1's under "41–60".
  const { cursor, dropCursor } = pager;
  const handleRefresh = useCallback(() => {
    if (cursor) dropCursor();
    // While a deferred read is out the next rows are on their way: there is nothing older to refresh.
    else if (!isPending) refreshRef.current?.();
  }, [cursor, dropCursor, isPending]);

  useImperativeHandle(ref, () => ({ refresh: handleRefresh }), [handleRefresh]);

  // Which table is drawn (`data-table-grid`). Until the flag answers the table is in a loading scope.
  const tableGate = useTableGridGate();
  const gateLoading = tableGate === 'loading';

  // In a loading scope (an embedding tab whose parent still loads, or the table's flag) the table reads nothing: it
  // draws its own loading rows.
  const scoped = useLoadingScope() || gateLoading;

  const className = embedded ? EMBEDDED_PAGE_OFFSET : undefined;

  // The boundary is here, not at each call site: the device Overview and customer Logs tabs embed this table with
  // nothing around it, so a failed query used to reach the route boundary and take the whole details page down.
  // A different query (the device, a filter restored from history) clears it.
  const queryKey = JSON.stringify([query, params.search]);

  return (
    <ContentErrorBoundary
      label="LogsTable"
      resetKey={queryKey}
      // The failed state keeps the header, with Refresh as the retry, and drops the search toolbar: its filter button
      // would open the table's modal, which went down with the table.
      fallback={(retry, { isOffline }) => (
        <LogsPageView
          onRefresh={retry}
          showHeader={showHeader}
          className={className}
          search={searchInput}
          onSearchChange={setSearchInput}
          hideSearch
        >
          <LoadError {...loadErrorProps(isOffline, LOAD_ERROR_MESSAGE, retry)} />
        </LogsPageView>
      )}
    >
      <LogsPageView
        onRefresh={handleRefresh}
        showHeader={showHeader}
        className={className}
        // The search toolbar sits outside the Suspense boundary so it keeps focus
        // across re-queries, and hides while the empty state is shown.
        search={searchInput}
        onSearchChange={setSearchInput}
        hideSearch={isEmpty}
        onOpenFilters={() => setMobileFilterOpen(true)}
      >
        <LoadingWhen loading={gateLoading}>
          <LogsTableContent
            scoped={scoped}
            deviceScoped={deviceScoped}
            organizationLocked={Boolean(organizationId)}
            backendFilters={deferredFilters.filter}
            sort={deferredFilters.sort}
            dateFilter={dateFilter}
            search={deferredSearch}
            tableFilters={tableFilters}
            onFilterChange={handleFilterChange}
            onRefreshRef={refreshRef}
            onEmptyChange={setIsEmpty}
            mobileFilterOpen={mobileFilterOpen}
            onMobileFilterClose={() => setMobileFilterOpen(false)}
            tableLayout={tableLayoutFor(tableGate)}
            place={place}
            isPending={isPending}
            pager={pager}
            pageVariables={deferredPage}
            paramPrefix={paramPrefix}
          />
        </LoadingWhen>
      </LogsPageView>
    </ContentErrorBoundary>
  );
});
LogsTable.displayName = 'LogsTable';
