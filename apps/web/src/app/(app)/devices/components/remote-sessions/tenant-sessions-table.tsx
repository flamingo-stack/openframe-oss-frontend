'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import {
  ComputerMouseIcon,
  Filter02Icon,
  SearchIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  type AutoRefreshControlProps,
  Button,
  type ColumnDef,
  type DataTableSettings,
  type DateFilterResult,
  type DateRange,
  FilterModal,
  type NoDataProps,
  useDataTable,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import {
  CURSOR_PAGER_KEYS,
  type CursorPagerFooterProps,
  type CursorPagerVariables,
  useApiParams,
  useCursorPager,
  type UseCursorPagerReturn,
} from '@flamingo-stack/openframe-frontend-core/hooks';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { useLazyLoadQuery } from 'react-relay';
import type { tenantRemoteSessionsRelayQuery as TenantSessionsQuery } from '@/__generated__/tenantRemoteSessionsRelayQuery.graphql';
import { multiColumnFilter } from '@/app/(app)/software/components/shared/column-filters';
import { NO_ITEMS, noop, useRetryKey } from '@/app/components/shared';
import type { TableDateFilter } from '@/app/components/shared/date-column-header';
import { LiveTable, loadingPlaceholderRows } from '@/app/components/shared/live-table';
import { readCursor, StaleCursorBoundary } from '@/app/components/shared/stale-cursor-boundary';
import { forwardPage } from '@/app/hooks/forward-page';
import { useDeferredQuery } from '@/app/hooks/use-deferred-query';
import { useNow } from '@/app/hooks/use-now';
import { usePagedTable } from '@/app/hooks/use-paged-table';
import { useQueuedParamsWrite } from '@/app/hooks/use-queued-params-write';
import { useRefetchPage } from '@/app/hooks/use-refetch-page';
import type { TableLayout } from '@/app/hooks/use-table-layout';
import { tenantRemoteSessionsRelayQuery } from '@/graphql/remote-sessions/tenant-remote-sessions-relay';
import { dateRangeFromParams, toDayParam } from '@/lib/date-filter-params';
import { PAGED_LISTS } from '@/lib/paged-lists';
import { useLiveRows } from '../../hooks/use-remote-session-watch-gate';
import { useDeleteRemoteSession } from '../../hooks/use-session-recordings';
import { useTenantSessionFilterOptions } from '../../hooks/use-tenant-session-filter-options';
import { useTenantSessionRows } from '../../hooks/use-tenant-session-rows';
import { emptyDescription } from '../tabs/remote-sessions-tab';
import { DeleteSessionDialog } from './delete-session-dialog';
import { liveSessionRowClass } from './remote-session-columns';
import { EXPIRES_FILTER_OPTIONS, sessionHref } from './session-status';
import {
  keepLastPick,
  TENANT_SESSION_COLUMNS,
  type TenantSessionRow,
  type TenantSessionsParams,
  tenantSessionColumns,
  tenantSessionsVariables,
  toTenantSessionRow,
} from './tenant-session-columns';

/** Rows per page past the running sessions (page 1 carries those on top of it). */
const PAGE_SIZE = 20;

type FilterKey = 'device' | 'customer' | 'expires';
const FILTER_KEYS: FilterKey[] = ['device', 'customer', 'expires'];
/** The server takes one of these at a time; devices are a list. */
const SINGLE_VALUE_FILTERS: ReadonlySet<FilterKey> = new Set(['customer', 'expires']);

const NO_SESSIONS: NoDataProps = {
  icon: <ComputerMouseIcon />,
  title: 'No remote sessions',
  description: 'Remote sessions on your devices will appear here.',
};

// ----------------------------------------------------------------
// Table
// ----------------------------------------------------------------

interface TenantSessionsTableProps {
  rows: TenantSessionRow[];
  totalCount: number;
  /**
   * The First · Prev · Next footer (`usePagedTable`), with no range: page 1 holds the running sessions on top of a
   * page, so "1–20" would be wrong. `null` while the page is read.
   */
  pager: CursorPagerFooterProps | null;
  /** The auto-refresh picker above the table (`usePagedTable`). */
  refresh?: AutoRefreshControlProps;
  isPending: boolean;
  tableFilters: Record<FilterKey, string[]>;
  onFilterChange: (filters: Record<string, string[]>) => void;
  dateFilter: TableDateFilter;
  onDeleted: () => void;
  /** The table's layout (`TenantSessionsShell`'s `tableLayout`). */
  tableLayout: TableLayout;
}

/**
 * The grid table's settings: the gear's menu of columns, with the viewer's layout (hidden columns, their order, resized
 * widths) kept in the browser under this table's own key.
 */
const TENANT_SESSIONS_TABLE_SETTINGS: DataTableSettings = { storageKey: 'remote-sessions' };

/** The mobile filters button, the page's full width: the header funnels go with the header cells below `md`. */
function MobileFiltersButton({ onClick }: { onClick?: () => void }) {
  return (
    <div className="content-md:hidden">
      <Button
        variant="outline"
        fullWidth
        onClick={onClick}
        disabled={!onClick}
        leftIcon={<Filter02Icon className="text-ods-text-primary" />}
      >
        Filter
      </Button>
    </div>
  );
}

/**
 * The sessions table. In a loading scope (the recordings gate or the first page has not answered) it draws itself:
 * the live columns and header with inert funnels over one page of placeholder rows drawn with the real cells, each
 * part its own loading state, and asks for nothing (not even the
 * funnels' options).
 */
function TenantSessionsTable({
  rows,
  totalCount,
  pager,
  refresh,
  isPending,
  tableFilters,
  onFilterChange,
  dateFilter,
  onDeleted,
  tableLayout,
}: TenantSessionsTableProps) {
  const loading = useLoadingScope();
  const router = useRouter();
  // The "Expires in N hours" countdown keeps moving while the page is open.
  const now = useNow(60_000);
  const liveRows = useLiveRows();
  const {
    deviceOptions,
    customerOptions,
    pending: optionsPending,
  } = useTenantSessionFilterOptions({
    enabled: !loading,
  });
  const deleteSession = useDeleteRemoteSession('');
  const [deleteTarget, setDeleteTarget] = useState<TenantSessionRow | null>(null);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  const columns = useMemo<ColumnDef<TenantSessionRow>[]>(
    () =>
      tenantSessionColumns({
        dateFilter,
        deviceOptions,
        customerOptions,
        optionsPending,
        now,
        liveRows,
        onOpen: row => {
          const href = sessionHref(row, liveRows);
          if (href) router.push(href);
        },
        onDelete: setDeleteTarget,
        layout: tableLayout,
      }),
    [dateFilter, deviceOptions, customerOptions, optionsPending, now, liveRows, router, tableLayout],
  );

  // The funnels' selection lives in the URL: every column's picks in, all of
  // them out on any change.
  const { columnFilters, onColumnFiltersChange } = multiColumnFilter(tableFilters, onFilterChange);

  // Filtering, sorting and paging all happen on the server: the table renders
  // what it is given and only reports the funnels' picks.
  // In a loading scope the table holds one page of placeholder rows, drawn with the real cells (each cell draws its
  // own loading form).
  const loadingRows = useMemo(() => (loading ? loadingPlaceholderRows<TenantSessionRow>(PAGE_SIZE) : null), [loading]);
  const table = useDataTable<TenantSessionRow>({
    data: loadingRows ?? rows,
    columns,
    getRowId: (row: TenantSessionRow) => row.id,
    enableSorting: false,
    state: { columnFilters },
    onColumnFiltersChange,
  });

  const filterGroups = useMemo(
    () => [
      { id: TENANT_SESSION_COLUMNS.device.id, title: 'Device', options: deviceOptions },
      { id: TENANT_SESSION_COLUMNS.customer.id, title: 'Customer', options: customerOptions },
      { id: TENANT_SESSION_COLUMNS.expires.id, title: 'Recording Expires', options: EXPIRES_FILTER_OPTIONS },
    ],
    [deviceOptions, customerOptions],
  );

  // The date range narrows like a funnel does; the sort direction never does.
  const hasDateRange = dateFilter.range !== undefined;
  const hasColumnFilters = columnFilters.length > 0;
  const isNarrowed = hasDateRange || hasColumnFilters;
  // An empty LATER page (a cursor about to be dropped) keeps the table and its footer, so First stays reachable.
  const laterPage = pager ? !pager.isFirstPage : false;
  const showHeader = loading || rows.length > 0 || isNarrowed || isPending || laterPage;
  const emptyState: NoDataProps = isNarrowed
    ? {
        icon: <SearchIcon />,
        title: 'No remote sessions found',
        description: emptyDescription({ search: '', hasDateRange, hasColumnFilters }),
      }
    : NO_SESSIONS;

  return (
    <>
      {/* On mobile the header funnels go with the header cells: the standard
          filters button opens the same filters as a modal. */}
      <MobileFiltersButton onClick={loading ? undefined : () => setMobileFilterOpen(true)} />

      <LiveTable
        table={table}
        pageSize={PAGE_SIZE}
        showHeader={showHeader}
        itemName="result"
        totalCount={totalCount}
        isPending={isPending}
        emptyState={emptyState}
        rowHref={row => sessionHref(row, liveRows)}
        rowClassName={row => liveSessionRowClass(row, liveRows)}
        pager={pager}
        refresh={refresh}
        loadingCells={loading}
        // The grid table is the page's scroll area: it fills the height under the page title, and the page does not
        // scroll. The card rows take neither option.
        layout={tableLayout}
        maxHeight="fill"
        settings={TENANT_SESSIONS_TABLE_SETTINGS}
      />

      <FilterModal
        isOpen={mobileFilterOpen}
        onClose={() => setMobileFilterOpen(false)}
        filterGroups={filterGroups}
        currentFilters={tableFilters}
        onFilterChange={onFilterChange}
        dateFilter={{
          title: 'Session',
          sort: dateFilter.sortDirection,
          range: dateFilter.range,
          onChange: dateFilter.onApply,
        }}
      />

      <DeleteSessionDialog
        open={deleteTarget !== null}
        onOpenChange={open => {
          if (!open) setDeleteTarget(null);
        }}
        startedAt={deleteTarget?.startedAt ?? null}
        isPending={deleteSession.isPending}
        onConfirm={() => {
          if (!deleteTarget) return;
          // A refusal is toasted and the row stays as it was.
          deleteSession.mutate(
            {
              sessionId: deleteTarget.id,
              recordingId: deleteTarget.recordingId,
              deviceId: deleteTarget.deviceId,
            },
            {
              onSuccess: onDeleted,
              onSettled: () => setDeleteTarget(null),
            },
          );
        }}
      />
    </>
  );
}

// ----------------------------------------------------------------
// Relay content - with its own Suspense boundary
// ----------------------------------------------------------------

interface TenantSessionsContentProps extends Omit<
  TenantSessionsTableProps,
  'rows' | 'totalCount' | 'pager' | 'refresh' | 'onDeleted'
> {
  /** Deferred — the filter and the sort (lag the URL while the next page is read). */
  variables: ReturnType<typeof tenantSessionsVariables>;
  /** The list's position in the URL: footer props, the stale check, the cursor drop. */
  pager: UseCursorPagerReturn;
  /** Deferred — the page variables to spread into the query (lag the URL while the next page is read). */
  pageVariables: CursorPagerVariables;
}

/**
 * The sessions table under the stale-cursor boundary: a cursor the server refuses (`INVALID_CURSOR`: issued under
 * another sort, or before a release that changed the cursors) drops to the first page; any other error goes up
 * unchanged.
 */
function TenantSessionsContent(props: TenantSessionsContentProps) {
  return (
    <StaleCursorBoundary cursor={readCursor(props.pageVariables)} onStaleCursor={props.pager.dropCursor}>
      <TenantSessionsContentLoading {...props} />
    </StaleCursorBoundary>
  );
}

/** Its own boundary, the whole output of its own component (the loading standard): in its scope the reader draws its
 * own loading form. */
function TenantSessionsContentLoading(props: TenantSessionsContentProps) {
  return (
    <LoadingSuspense label="Loading remote sessions">
      <TenantSessionsContentReader {...props} />
    </LoadingSuspense>
  );
}

/** The page the URL names. In a loading scope (its boundary's fallback, the gate) it runs no query: the table draws
 * itself. */
function TenantSessionsContentReader(props: TenantSessionsContentProps) {
  if (useLoadingScope()) {
    return (
      <TenantSessionsTable
        rows={NO_ITEMS}
        totalCount={0}
        pager={null}
        isPending={false}
        tableFilters={props.tableFilters}
        onFilterChange={props.onFilterChange}
        dateFilter={props.dateFilter}
        onDeleted={noop}
        tableLayout={props.tableLayout}
      />
    );
  }
  return <TenantSessionsContentQuery {...props} />;
}

function TenantSessionsContentQuery({ variables, pager, pageVariables, ...tableProps }: TenantSessionsContentProps) {
  const retryKey = useRetryKey();
  // One page per request, its cursor in the URL (`cursor`); forward only.
  const queryVariables = { ...variables, ...forwardPage(pageVariables, PAGE_SIZE) };
  const queryData = useLazyLoadQuery<TenantSessionsQuery>(tenantRemoteSessionsRelayQuery, queryVariables, {
    fetchPolicy: 'store-and-network',
    fetchKey: retryKey,
  });
  // A delete, or a running row that ended, reads the page on screen again: the row goes on the server's word. A failed
  // refetch keeps the page as it was; the next one, or the auto-refresh, corrects it.
  const refetch = useRefetchPage<TenantSessionsQuery>(tenantRemoteSessionsRelayQuery, queryVariables);
  const refetchPage = () => {
    refetch().catch(noop);
  };

  const { edges, pageInfo } = queryData.remoteSessions;
  const pageRows = useMemo(() => edges.flatMap(edge => (edge?.node ? [toTenantSessionRow(edge.node)] : [])), [edges]);
  const paged = usePagedTable({
    pager,
    pageInfo,
    rowCount: edges.length,
    refetch,
    isPending: tableProps.isPending,
  });

  // The running sessions polled and merged into the first page, one row per session.
  const { rows, totalCount } = useTenantSessionRows({
    pageRows,
    totalCount: queryData.remoteSessions.totalCount,
    filter: variables.filter,
    firstPage: pager.isFirstPage,
    onRefresh: refetchPage,
  });

  return (
    <TenantSessionsTable
      rows={rows}
      totalCount={totalCount}
      // The count and no range: page 1 holds up to 100 running sessions on top of `first`, so "1–20" would be wrong.
      pager={{ ...paged.pager, rangeStart: undefined }}
      refresh={paged.refresh}
      onDeleted={refetchPage}
      {...tableProps}
    />
  );
}

// ----------------------------------------------------------------
// Shell - URL state + Suspense boundary
// ----------------------------------------------------------------

/**
 * The tenant's remote sessions on every device: the device tab's table with
 * DEVICE and CUSTOMER columns, filtered, sorted and paged on the server (First ·
 * Prev · Next). The funnels, the SESSION calendar and the page's cursor live in
 * the URL (a top-level page: no prefix), so a filtered view is a shareable link.
 * A change to a funnel or the calendar drops the cursor in the SAME URL write:
 * one history entry on page 2+, so Back returns to the old view.
 *
 * `tableLayout="grid"` draws the lib's grid table (48px one-line rows, the session column pinned, Delete and Open as
 * action columns, the gear menu) as the page's scroll area. Default `cards`.
 */
export function TenantSessionsShell({ tableLayout = 'cards' }: { tableLayout?: TableLayout }) {
  const { params, setParams } = useApiParams(
    {
      device: { type: 'array', default: [] },
      customer: { type: 'array', default: [] },
      expires: { type: 'array', default: [] },
      // Session-date range (local `yyyy-MM-dd`, inclusive) + its sort direction.
      // `desc` (newest first) is the default and stays out of the URL.
      dateFrom: { type: 'string', default: '' },
      dateTo: { type: 'string', default: '' },
      sortDir: { type: 'string', default: 'desc' },
    },
    { resetKeys: CURSOR_PAGER_KEYS, resetHistory: 'push' },
  );
  const pager = useCursorPager({
    pageSize: PAGE_SIZE,
    ...PAGED_LISTS.remoteSessions,
    resetOn: JSON.stringify(params),
  });

  const dateRange: DateRange | undefined = useMemo(
    () => dateRangeFromParams(params.dateFrom, params.dateTo),
    [params.dateFrom, params.dateTo],
  );
  const sortDirection: 'asc' | 'desc' = params.sortDir === 'asc' ? 'asc' : 'desc';

  // Memoized on purpose: `useDeferredQuery` tells a pending refetch by identity.
  const variables = useMemo(() => {
    const urlState: TenantSessionsParams = {
      device: params.device,
      customer: params.customer,
      expires: params.expires,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      sortDir: params.sortDir,
    };
    return tenantSessionsVariables(urlState, dateRange);
  }, [params.device, params.customer, params.expires, params.dateFrom, params.dateTo, params.sortDir, dateRange]);
  // The query lags the controls while a refetch runs, page included, so the rows
  // on screen stay (dimmed) instead of dropping to the skeleton.
  const {
    deferredFilters: deferredVariables,
    deferredPage,
    isPending,
  } = useDeferredQuery(variables, '', pager.variables);

  const tableFilters = useMemo(
    () => ({ device: params.device, customer: params.customer, expires: params.expires }),
    [params.device, params.customer, params.expires],
  );

  // The mobile modal commits its funnels and its date section in the same tick;
  // the queued writer merges them into one URL write.
  const queueParamsWrite = useQueuedParamsWrite(setParams);

  const handleFilterChange = useCallback(
    (filters: Record<string, string[]>) => {
      const next = Object.fromEntries(
        FILTER_KEYS.map(key => {
          const picked = filters[key] ?? [];
          return [key, SINGLE_VALUE_FILTERS.has(key) ? keepLastPick(tableFilters[key], picked) : picked];
        }),
      );
      queueParamsWrite(next);
    },
    [queueParamsWrite, tableFilters],
  );

  // `sortDir: ''` for the default direction, so the URL drops the param.
  const handleDateFilterApply = useCallback(
    (result: DateFilterResult) => {
      queueParamsWrite({
        sortDir: result.sort === 'desc' ? '' : result.sort,
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

  return (
    <div className="flex flex-col gap-[var(--spacing-system-m)]">
      <TenantSessionsContent
        variables={deferredVariables}
        pager={pager}
        pageVariables={deferredPage}
        isPending={isPending}
        tableFilters={tableFilters}
        onFilterChange={handleFilterChange}
        dateFilter={dateFilter}
        tableLayout={tableLayout}
      />
    </div>
  );
}
