'use client';

import { ClipboardListIcon, SearchIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  type ColumnDef,
  DataTable,
  FilterModal,
  type NoDataProps,
  type Row,
  useDataTable,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { useEffect } from 'react';
import { graphql, useLazyLoadQuery, usePaginationFragment } from 'react-relay';
import type {
  softwareLogsTable_query$data,
  softwareLogsTable_query$key,
} from '@/__generated__/softwareLogsTable_query.graphql';
import type { softwareLogsTablePaginationQuery as SoftwareLogsTablePaginationQueryType } from '@/__generated__/softwareLogsTablePaginationQuery.graphql';
import type { softwareLogsTableQuery as SoftwareLogsTableQueryType } from '@/__generated__/softwareLogsTableQuery.graphql';
import { EXECUTIONS_PAGE_SIZE, type ExecutionsTabState } from '@/app/(app)/scripts/shared/components/executions-table';
import type { FacetOption } from '@/app/(app)/scripts/shared/utils/facet-options';
import { liveColumnMeta, useRetryKey } from '@/app/components/shared';
import type { PackageManagerType, SoftwareAction } from '@/generated/schema-enums';
import { multiSelectFilterFn } from '@/lib/table-filters';
import { singleColumnFilter } from '../shared/single-column-filter';
import { SoftwareLogCustomerCell } from './software-log-customer-cell';
import { SoftwareLogDeviceCell } from './software-log-device-cell';
import { SoftwareLogResultPanel } from './software-log-result-panel';
import { SoftwareLogResultToggle } from './software-log-result-toggle';
import { matchesSoftwareLog } from './software-log-search';
import { SoftwareLogStatusCell } from './software-log-status-cell';
import { SOFTWARE_LOG_COLUMNS } from './software-logs-columns';
import { softwareRunStatusLabel } from './software-run-status';
import { useResultPhases } from './use-result-phases';

/**
 * Execution history for one catalog package's install or update runs —
 * `softwareExecutions(packageManager, packageName, action)`, the software twin of
 * `scriptExecutions`, with the STATUS facets riding the same operation.
 *
 * One run of the package is `search` = its executionId: every device's execution
 * of a dispatch carries it, and no filter field narrows on it.
 */
const softwareLogsTableQuery = graphql`
  query softwareLogsTableQuery(
    $packageManager: PackageManagerType!
    $packageName: String!
    $action: SoftwareAction!
    $filter: ScriptExecutionFilterInput
    $search: String
    $sort: SortInput
    $first: Int!
    $after: String
  ) {
    ...softwareLogsTable_query
      @arguments(
        packageManager: $packageManager
        packageName: $packageName
        action: $action
        filter: $filter
        search: $search
        sort: $sort
        first: $first
        after: $after
      )
    softwareExecutionFilters(
      packageManager: $packageManager
      packageName: $packageName
      action: $action
      filter: $filter
      search: $search
    ) {
      # STATUS is the one column the backend filters on, so its funnel is the
      # only facet this table asks for.
      statuses {
        value
        count
      }
    }
  }
`;

const softwareLogsTableFragment = graphql`
  fragment softwareLogsTable_query on Query
  @refetchable(queryName: "softwareLogsTablePaginationQuery")
  @argumentDefinitions(
    packageManager: { type: "PackageManagerType!" }
    packageName: { type: "String!" }
    action: { type: "SoftwareAction!" }
    filter: { type: "ScriptExecutionFilterInput" }
    search: { type: "String" }
    sort: { type: "SortInput" }
    first: { type: "Int", defaultValue: 20 }
    after: { type: "String" }
  ) {
    softwareExecutions(
      packageManager: $packageManager
      packageName: $packageName
      action: $action
      filter: $filter
      search: $search
      sort: $sort
      first: $first
      after: $after
    ) @connection(key: "softwareLogsTable_softwareExecutions") {
      edges {
        node {
          id
          # What the status funnel narrows the rows on screen by, while the
          # refetch it triggered is still in flight.
          status
          machine {
            ...softwareLogDeviceCell_machine
            ...softwareLogCustomerCell_machine
          }
          ...softwareLogStatusCell_execution
          ...softwareLogResultPanel_execution
          ...softwareLogSearch_execution
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

type SoftwareLogRow = NonNullable<softwareLogsTable_query$data['softwareExecutions']>['edges'][number]['node'];

const EMPTY_STATE: NoDataProps = {
  icon: <ClipboardListIcon />,
  title: 'No Logs Yet',
  description: 'Each device reports here once the run reaches it',
};

const getRowId = (row: SoftwareLogRow) => row.id;

interface SoftwareLogsTableProps {
  packageManager: PackageManagerType;
  packageName: string;
  action: SoftwareAction;
  /** The run — the query's `search` scope. */
  executionId: string;
  /** "Update" / "Install" — the first word of every STATUS cell. */
  actionLabel: string;
  state: ExecutionsTabState;
}

/**
 * Software Update Details' logs (design 409:47432): one row per device of the
 * run, its output unfolding in place under "Show Result". There is no page per
 * execution to open — the row IS the execution.
 *
 * Only STATUS has a funnel: it is the one column the backend filters on. The
 * design's Customer funnel and Device Tags button wait for server support
 * rather than narrowing the loaded page client-side.
 */
export function SoftwareLogsTable({
  packageManager,
  packageName,
  action,
  executionId,
  actionLabel,
  state,
}: SoftwareLogsTableProps) {
  const {
    backendFilters,
    sort,
    narrowSearch,
    isPending,
    tableFilters,
    onFilterChange,
    mobileFilterOpen,
    onMobileFilterClose,
    stickyHeaderOffset,
    onEmptyChange,
  } = state;

  const retryKey = useRetryKey();
  const queryData = useLazyLoadQuery<SoftwareLogsTableQueryType>(
    softwareLogsTableQuery,
    {
      packageManager,
      packageName,
      action,
      filter: backendFilters,
      // `search` is this page's SCOPE, not a typed term: every device's
      // execution of the run carries its executionId, and search is the only
      // argument that narrows on it. The typed term narrows client-side below.
      search: executionId,
      sort,
      first: EXECUTIONS_PAGE_SIZE,
      after: null,
    },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );

  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    SoftwareLogsTablePaginationQueryType,
    softwareLogsTable_query$key
  >(softwareLogsTableFragment, queryData);

  const { phases, toggle, collapsed } = useResultPhases();

  // The facet labels read the way this page's tags do ("Success", not "Completed").
  const statusOptions: FacetOption[] = (queryData.softwareExecutionFilters?.statuses ?? []).map(facet => ({
    id: facet.value,
    label: softwareRunStatusLabel(facet.value),
    value: facet.value,
    count: facet.count,
  }));

  const needle = narrowSearch.trim().toLowerCase();
  const allRows = (data.softwareExecutions?.edges ?? []).map(edge => edge.node);
  const logs = needle ? allRows.filter(row => matchesSoftwareLog(row, needle)) : allRows;

  const fetchNextPage = () => {
    if (hasNext && !isLoadingNext) loadNext(EXECUTIONS_PAGE_SIZE);
  };

  const columns: ColumnDef<SoftwareLogRow>[] = [
    {
      id: SOFTWARE_LOG_COLUMNS.device.id,
      header: SOFTWARE_LOG_COLUMNS.device.header,
      cell: ({ row }: { row: Row<SoftwareLogRow> }) => <SoftwareLogDeviceCell machine={row.original.machine} />,
      enableSorting: false,
      meta: liveColumnMeta(SOFTWARE_LOG_COLUMNS.device),
    },
    {
      id: SOFTWARE_LOG_COLUMNS.customer.id,
      header: SOFTWARE_LOG_COLUMNS.customer.header,
      cell: ({ row }: { row: Row<SoftwareLogRow> }) => <SoftwareLogCustomerCell machine={row.original.machine} />,
      enableSorting: false,
      meta: liveColumnMeta(SOFTWARE_LOG_COLUMNS.customer),
    },
    {
      id: SOFTWARE_LOG_COLUMNS.status.id,
      header: SOFTWARE_LOG_COLUMNS.status.header,
      accessorFn: (row: SoftwareLogRow) => row.status,
      cell: ({ row }: { row: Row<SoftwareLogRow> }) => (
        <SoftwareLogStatusCell execution={row.original} actionLabel={actionLabel} />
      ),
      enableSorting: false,
      filterFn: multiSelectFilterFn,
      meta: liveColumnMeta(SOFTWARE_LOG_COLUMNS.status, { filter: { options: statusOptions } }),
    },
    {
      id: SOFTWARE_LOG_COLUMNS.result.id,
      cell: ({ row }: { row: Row<SoftwareLogRow> }) => (
        <SoftwareLogResultToggle
          open={phases.get(row.original.id) === 'open'}
          onToggle={() => toggle(row.original.id)}
        />
      ),
      enableSorting: false,
      meta: liveColumnMeta(SOFTWARE_LOG_COLUMNS.result),
    },
  ];

  const { columnFilters, onColumnFiltersChange } = singleColumnFilter(
    SOFTWARE_LOG_COLUMNS.status.id,
    tableFilters.status ?? [],
    status => onFilterChange({ status }),
  );

  const table = useDataTable<SoftwareLogRow>({
    data: logs,
    columns,
    getRowId,
    enableSorting: false,
    state: { columnFilters },
    onColumnFiltersChange,
  });

  const renderSubRow = (row: SoftwareLogRow) => {
    const phase = phases.get(row.id);
    if (!phase) return null;
    return <SoftwareLogResultPanel execution={row} expanded={phase === 'open'} onCollapsed={() => collapsed(row.id)} />;
  };

  // An open row sits on the page ground, cells and output alike (design 409:47460).
  const rowClassName = (row: SoftwareLogRow) =>
    cn(
      'mb-1 transition-colors duration-200 motion-reduce:transition-none',
      phases.get(row.id) === 'open' && 'bg-ods-bg',
    );

  // Header, empty copy and the toolbar hand-off follow the script Execution
  // History table (`executions-table.tsx`), which reasons through each case.
  const hasActiveFilter = columnFilters.length > 0;
  const showHeader = logs.length > 0 || hasActiveFilter || isPending;

  const resolvedEmptyState: NoDataProps = hasNext
    ? { icon: <SearchIcon />, title: 'Looking through the remaining logs…' }
    : narrowSearch || hasActiveFilter
      ? {
          icon: <SearchIcon />,
          title: 'No logs found',
          description: narrowSearch
            ? `Nothing matches "${narrowSearch}". Try adjusting your search or filters.`
            : 'Try adjusting your filters.',
        }
      : EMPTY_STATE;

  const isEmptyState = logs.length === 0 && !narrowSearch && !hasActiveFilter && !hasNext && !isPending;
  useEffect(() => {
    onEmptyChange(isEmptyState);
  }, [isEmptyState, onEmptyChange]);
  useEffect(() => () => onEmptyChange(false), [onEmptyChange]);

  return (
    <>
      <div className={`transition-opacity duration-200 ${isPending ? 'opacity-60' : ''}`}>
        <DataTable table={table}>
          {showHeader && (
            <DataTable.Header
              stickyHeader
              stickyHeaderOffset={stickyHeaderOffset}
              rightSlot={<DataTable.RowCount itemName="result" />}
            />
          )}
          <DataTable.Body
            skeletonRows={EXECUTIONS_PAGE_SIZE}
            emptyState={resolvedEmptyState}
            rowClassName={rowClassName}
            renderSubRow={renderSubRow}
          />
          {/* The rows are narrowed client-side, so a page can come back empty
              and still have more behind it: keep loading until the run is done. */}
          {(logs.length > 0 || hasNext) && (
            <DataTable.InfiniteFooter
              hasNextPage={hasNext}
              isFetchingNextPage={isLoadingNext}
              onLoadMore={fetchNextPage}
              skeletonRows={2}
              // The search narrows the loaded rows on the client, so a page can
              // arrive and add no match: progress is read off this count instead.
              loadedCount={allRows.length}
            />
          )}
        </DataTable>
      </div>

      <FilterModal
        isOpen={mobileFilterOpen}
        onClose={onMobileFilterClose}
        filterGroups={[{ id: SOFTWARE_LOG_COLUMNS.status.id, title: 'Status', options: statusOptions }]}
        onFilterChange={onFilterChange}
        currentFilters={{ status: tableFilters.status ?? [] }}
      />
    </>
  );
}
