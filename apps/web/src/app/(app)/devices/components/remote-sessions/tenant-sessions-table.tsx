'use client';

import {
  ComputerMouseIcon,
  Filter02Icon,
  SearchIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Button,
  type ColumnDef,
  DataTable,
  type DateFilterResult,
  type DateRange,
  FilterModal,
  type NoDataProps,
  useDataTable,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useApiParams } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useRouter } from 'next/navigation';
import { Suspense, useCallback, useMemo, useState } from 'react';
import { useLazyLoadQuery, usePaginationFragment } from 'react-relay';
import type { tenantRemoteSessionsRelay_query$key as TenantSessionsKey } from '@/__generated__/tenantRemoteSessionsRelay_query.graphql';
import type { tenantRemoteSessionsRelayPaginationQuery as TenantSessionsPaginationQuery } from '@/__generated__/tenantRemoteSessionsRelayPaginationQuery.graphql';
import type { tenantRemoteSessionsRelayQuery as TenantSessionsQuery } from '@/__generated__/tenantRemoteSessionsRelayQuery.graphql';
import { multiColumnFilter } from '@/app/(app)/software/components/shared/column-filters';
import { useRetryKey } from '@/app/components/shared';
import { ConfirmDialog } from '@/app/components/shared/confirm-dialog';
import { DateColumnHeader, type TableDateFilter } from '@/app/components/shared/date-column-header';
import { skeletonColumnMeta } from '@/app/components/shared/table-column-layout';
import { useDeferredQuery } from '@/app/hooks/use-deferred-query';
import { useNow } from '@/app/hooks/use-now';
import { useQueuedParamsWrite } from '@/app/hooks/use-queued-params-write';
import {
  tenantRemoteSessionsRelayFragment,
  tenantRemoteSessionsRelayQuery,
} from '@/graphql/remote-sessions/tenant-remote-sessions-relay';
import { dateRangeFromParams, toDayParam } from '@/lib/date-filter-params';
import { formatDateTime } from '@/lib/format-date';
import { routes } from '@/lib/routes';
import { useDeleteSessionRecording } from '../../hooks/use-session-recordings';
import { useTenantSessionFilterOptions } from '../../hooks/use-tenant-session-filter-options';
import { emptyDescription } from '../tabs/remote-sessions-tab';
import { canOpenSession, EXPIRES_FILTER_OPTIONS } from './session-status';
import {
  keepLastPick,
  TENANT_SESSION_COLUMN_ORDER,
  TENANT_SESSION_COLUMNS,
  type TenantSessionRow,
  type TenantSessionsParams,
  tenantSessionColumns,
  tenantSessionsVariables,
  toTenantSessionRow,
} from './tenant-session-columns';

const PAGE_SIZE = 20;

type FilterKey = 'device' | 'customer' | 'expires';
const FILTER_KEYS: FilterKey[] = ['device', 'customer', 'expires'];
/** The server takes one of these at a time; devices are a list. */
const SINGLE_VALUE_FILTERS: ReadonlySet<FilterKey> = new Set(['customer', 'expires']);

/** The page a row opens: the session's recording, when it has one to play. */
function recordingHref(row: TenantSessionRow): string | null {
  return row.recordingId && canOpenSession(row) ? routes.devices.remoteSessionRecording(row.recordingId) : null;
}

const NO_SESSIONS: NoDataProps = {
  icon: <ComputerMouseIcon />,
  title: 'No remote sessions',
  description: 'Remote sessions on your devices will appear here.',
};

const EMPTY_ROWS: TenantSessionRow[] = [];

// ----------------------------------------------------------------
// Table
// ----------------------------------------------------------------

interface TenantSessionsTableProps {
  rows: TenantSessionRow[];
  totalCount: number;
  hasNext: boolean;
  isLoadingNext: boolean;
  onLoadMore: () => void;
  isPending: boolean;
  tableFilters: Record<FilterKey, string[]>;
  onFilterChange: (filters: Record<string, string[]>) => void;
  dateFilter: TableDateFilter;
  onDeleted: () => void;
}

function TenantSessionsTable({
  rows,
  totalCount,
  hasNext,
  isLoadingNext,
  onLoadMore,
  isPending,
  tableFilters,
  onFilterChange,
  dateFilter,
  onDeleted,
}: TenantSessionsTableProps) {
  const router = useRouter();
  // The "Expires in N hours" countdown keeps moving while the page is open.
  const now = useNow(60_000);
  const { deviceOptions, customerOptions, pending: optionsPending } = useTenantSessionFilterOptions();
  const deleteRecording = useDeleteSessionRecording('');
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
        onOpen: row => {
          const href = recordingHref(row);
          if (href) router.push(href);
        },
        onDelete: setDeleteTarget,
      }),
    [dateFilter, deviceOptions, customerOptions, optionsPending, now, router],
  );

  // The funnels' selection lives in the URL: every column's picks in, all of
  // them out on any change.
  const { columnFilters, onColumnFiltersChange } = multiColumnFilter(tableFilters, onFilterChange);

  // Filtering, sorting and paging all happen on the server: the table renders
  // what it is given and only reports the funnels' picks.
  const table = useDataTable<TenantSessionRow>({
    data: rows,
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
      { id: TENANT_SESSION_COLUMNS.expires.id, title: 'Expires', options: EXPIRES_FILTER_OPTIONS },
    ],
    [deviceOptions, customerOptions],
  );

  // The date range narrows like a funnel does; the sort direction never does.
  const hasDateRange = dateFilter.range !== undefined;
  const hasColumnFilters = columnFilters.length > 0;
  const isNarrowed = hasDateRange || hasColumnFilters;
  const showHeader = rows.length > 0 || isNarrowed || isPending;
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
      <div className="flex justify-end content-md:hidden">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setMobileFilterOpen(true)}
          aria-label="Open filters"
          leftIcon={<Filter02Icon className="text-ods-text-primary" />}
        />
      </div>

      {/* Dim (don't unmount) the stale rows while a deferred refetch is in flight. */}
      <div className={`transition-opacity duration-200 ${isPending ? 'opacity-60' : ''}`}>
        <DataTable table={table}>
          {showHeader && (
            <DataTable.Header
              stickyHeader
              rightSlot={<DataTable.RowCount itemName="result" totalCount={totalCount} />}
            />
          )}
          <DataTable.Body skeletonRows={4} emptyState={emptyState} rowClassName="mb-1" rowHref={recordingHref} />
          {rows.length > 0 && (
            <DataTable.InfiniteFooter
              hasNextPage={hasNext}
              isFetchingNextPage={isLoadingNext}
              onLoadMore={onLoadMore}
              skeletonRows={2}
            />
          )}
        </DataTable>
      </div>

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

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={open => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete Recording"
        description={
          <>
            Are you sure you want to delete the session recording from{' '}
            <span className="font-medium text-ods-accent">
              {deleteTarget ? formatDateTime(deleteTarget.startedAt) : ''}
            </span>
            ? This cannot be undone.
          </>
        }
        confirmLabel="Delete Recording"
        variant="destructive"
        isPending={deleteRecording.isPending}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteRecording.mutate(
            {
              sessionId: deleteTarget.id,
              recordingId: deleteTarget.recordingId,
              deviceId: deleteTarget.deviceId,
            },
            {
              onSuccess: () => {
                setDeleteTarget(null);
                onDeleted();
              },
            },
          );
        }}
      />
    </>
  );
}

// ----------------------------------------------------------------
// Skeleton
// ----------------------------------------------------------------

export function TenantSessionsSkeleton() {
  // The live layout with inert funnels and an inert calendar, so the header
  // does not shift when the rows arrive.
  const columns = useMemo<ColumnDef<TenantSessionRow>[]>(
    () =>
      TENANT_SESSION_COLUMN_ORDER.map(column => {
        const label = column.header;
        return {
          id: column.id,
          header: column.dateFilterable && label ? () => <DateColumnHeader label={label} /> : label,
          enableSorting: false,
          meta: skeletonColumnMeta(column),
        };
      }),
    [],
  );
  const table = useDataTable<TenantSessionRow>({
    data: EMPTY_ROWS,
    columns,
    getRowId: (row: TenantSessionRow) => row.id,
    enableSorting: false,
  });

  return (
    <DataTable table={table}>
      <DataTable.Header stickyHeader />
      <DataTable.Body loading={true} skeletonRows={PAGE_SIZE} emptyMessage="" rowClassName="mb-1" />
    </DataTable>
  );
}

// ----------------------------------------------------------------
// Relay content - inside the shell's Suspense boundary
// ----------------------------------------------------------------

interface TenantSessionsContentProps extends Omit<
  TenantSessionsTableProps,
  'rows' | 'totalCount' | 'hasNext' | 'isLoadingNext' | 'onLoadMore'
> {
  variables: ReturnType<typeof tenantSessionsVariables>;
  refreshKey: number;
}

function TenantSessionsContent({ variables, refreshKey, ...tableProps }: TenantSessionsContentProps) {
  const retryKey = useRetryKey();
  const queryData = useLazyLoadQuery<TenantSessionsQuery>(
    tenantRemoteSessionsRelayQuery,
    { ...variables, first: PAGE_SIZE, after: null },
    // A delete refetches the list: the row turns "Deleted" on the server's word.
    { fetchPolicy: 'store-and-network', fetchKey: `${retryKey}:${refreshKey}` },
  );
  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    TenantSessionsPaginationQuery,
    TenantSessionsKey
  >(tenantRemoteSessionsRelayFragment, queryData);

  const rows = useMemo(
    () => data.remoteSessions.edges.flatMap(edge => (edge?.node ? [toTenantSessionRow(edge.node)] : [])),
    [data.remoteSessions.edges],
  );
  const loadMore = useCallback(() => {
    if (hasNext && !isLoadingNext) loadNext(PAGE_SIZE);
  }, [hasNext, isLoadingNext, loadNext]);

  return (
    <TenantSessionsTable
      rows={rows}
      totalCount={data.remoteSessions.totalCount}
      hasNext={hasNext}
      isLoadingNext={isLoadingNext}
      onLoadMore={loadMore}
      {...tableProps}
    />
  );
}

// ----------------------------------------------------------------
// Shell - URL state + Suspense boundary
// ----------------------------------------------------------------

/**
 * The tenant's remote sessions on every device: the device tab's table with
 * DEVICE and CUSTOMER columns, filtered, sorted and paged on the server. The
 * funnels and the SESSION calendar live in the URL, so a filtered view is a
 * shareable link.
 */
export function TenantSessionsShell() {
  const { params, setParams } = useApiParams({
    device: { type: 'array', default: [] },
    customer: { type: 'array', default: [] },
    expires: { type: 'array', default: [] },
    // Session-date range (local `yyyy-MM-dd`, inclusive) + its sort direction.
    // `desc` (newest first) is the default and stays out of the URL.
    dateFrom: { type: 'string', default: '' },
    dateTo: { type: 'string', default: '' },
    sortDir: { type: 'string', default: 'desc' },
  });
  const [refreshKey, setRefreshKey] = useState(0);

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
  // The query lags the controls while a refetch runs, so the rows on screen stay
  // (dimmed) instead of dropping to the skeleton.
  const { deferredFilters: deferredVariables, isPending } = useDeferredQuery(variables, '');

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
      <Suspense fallback={<TenantSessionsSkeleton />}>
        <TenantSessionsContent
          variables={deferredVariables}
          refreshKey={refreshKey}
          isPending={isPending}
          tableFilters={tableFilters}
          onFilterChange={handleFilterChange}
          dateFilter={dateFilter}
          onDeleted={() => setRefreshKey(key => key + 1)}
        />
      </Suspense>
    </div>
  );
}
