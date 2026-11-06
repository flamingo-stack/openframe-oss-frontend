'use client';

import { ClipboardListIcon, SearchIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  type ColumnDef,
  FilterModal,
  type NoDataProps,
  type Row,
  useDataTable,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { useEffect, useMemo } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type {
  softwareLogsTableQuery as SoftwareLogsTableQueryType,
  softwareLogsTableQuery$data,
} from '@/__generated__/softwareLogsTableQuery.graphql';
import type { ExecutionsTabState } from '@/app/(app)/scripts/shared/components/executions-table';
import type { FacetOption } from '@/app/(app)/scripts/shared/utils/facet-options';
import { liveColumnMeta, useRetryKey } from '@/app/components/shared';
import { LiveTable, loadingPlaceholderRows } from '@/app/components/shared/live-table';
import { multiSelectFilterFn } from '@/lib/table-filters';
import { softwareActionStatusLabel } from '../action-list/software-action-status-tag';
import { singleColumnFilter } from '../shared/column-filters';
import { SoftwareLogCustomerCell } from './software-log-customer-cell';
import { SoftwareLogDeviceCell } from './software-log-device-cell';
import { SoftwareLogResultPanel } from './software-log-result-panel';
import { SoftwareLogResultToggleCell } from './software-log-result-toggle';
import { matchesSoftwareLog } from './software-log-search';
import { SoftwareLogStatusCell } from './software-log-status-cell';
import { SOFTWARE_LOG_COLUMNS } from './software-logs-columns';
import { ResultPhasesContext, useResultPhases } from './use-result-phases';

/**
 * Every target device of one run with its result — `softwareActionExecutions(actionId)`. Unlike the run's execution
 * history, it also lists the devices the run has not reached yet (offline, or a schedule still to fire) as SCHEDULED,
 * and a device whose update is on hold there (the app is open) as WAITING.
 *
 * The list comes whole (a run targets at most 100 devices), so the status funnel and the search narrow it here: a
 * tick or a keystroke lands at once, with no refetch.
 */
const softwareLogsTableQuery = graphql`
  query softwareLogsTableQuery($actionId: String!) {
    softwareActionExecutions(actionId: $actionId) {
      machineId
      # What the status funnel narrows the rows by.
      status
      ...softwareLogDeviceCell_device
      ...softwareLogCustomerCell_device
      ...softwareLogStatusCell_device
      ...softwareLogResultPanel_device
      ...softwareLogSearch_device
    }
  }
`;

type LogRow = softwareLogsTableQuery$data['softwareActionExecutions'][number];

const EMPTY_STATE: NoDataProps = {
  icon: <ClipboardListIcon />,
  title: 'No Logs Yet',
  description: 'Each device reports here once the run reaches it',
};

/** One row per target device. */
const getRowId = (row: LogRow) => row.machineId;

/** The rows a loading scope draws: one page, the size the list skeletons use. */
const PLACEHOLDER_ROW_COUNT = 20;

interface SoftwareLogsTableProps {
  /** The run (`SoftwareActionRun.id`), as `softwareActionExecutions` takes it. */
  actionId: string;
  /** "Update" / "Install" — the first word of every STATUS cell. */
  actionLabel: string;
  state: ExecutionsTabState;
}

/**
 * Software Update Details' logs (design 1051:15572): one row per device of the run, its output unfolding in place
 * under "Show Result". There is no page per device to open — the row IS the device's result.
 */
export function SoftwareLogsTable({ actionId, actionLabel, state }: SoftwareLogsTableProps) {
  const retryKey = useRetryKey();
  const data = useLazyLoadQuery<SoftwareLogsTableQueryType>(
    softwareLogsTableQuery,
    { actionId },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );
  return <SoftwareLogsRows allRows={data.softwareActionExecutions} actionLabel={actionLabel} state={state} />;
}

interface SoftwareLogsRowsProps {
  allRows: readonly LogRow[];
  actionLabel: string;
  state: ExecutionsTabState;
}

/**
 * The logs table itself, from the rows it is handed: no query, so it also draws in a loading scope, where the
 * header is real and the body is one page of placeholder rows with their real cells (`ActionDetailLogs` renders it
 * so before the run answers).
 */
export function SoftwareLogsRows({ allRows, actionLabel, state }: SoftwareLogsRowsProps) {
  const {
    narrowSearch,
    isPending,
    tableFilters,
    onFilterChange,
    mobileFilterOpen,
    onMobileFilterClose,
    stickyHeaderOffset,
    onEmptyChange,
  } = state;
  const loading = useLoadingScope();
  const { phases, toggle, collapsed } = useResultPhases();

  // The statuses the run's devices are in, and how many each: the list is whole, so these are the facets. The labels
  // read the way the tags do ("Success", not "Completed").
  const statusOptions = useMemo<FacetOption[]>(() => {
    const counts = new Map<string, number>();
    for (const row of allRows) counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
    return [...counts].map(([value, count]) => ({
      id: value,
      label: softwareActionStatusLabel(value) ?? value,
      value,
      count,
    }));
  }, [allRows]);

  // While the run is read the table holds one page of placeholder rows, drawn with their real cells (never narrowed:
  // a placeholder has nothing to match).
  const placeholderRows = useMemo(
    () => (loading ? loadingPlaceholderRows<LogRow>(PLACEHOLDER_ROW_COUNT) : null),
    [loading],
  );
  const needle = narrowSearch.trim().toLowerCase();
  const ticked = tableFilters.status ?? [];
  const logs =
    placeholderRows ??
    allRows.filter(
      row => (ticked.length === 0 || ticked.includes(row.status)) && (!needle || matchesSoftwareLog(row, needle)),
    );

  // Memoized by hand on purpose: TanStack keys its column model on this array's
  // identity and `flexRender` mounts each `cell` function as a component, so a
  // rebuilt array remounts every cell. The result cell reads the phases through
  // `ResultPhasesContext` precisely so they are not a dependency here.
  const columns = useMemo<ColumnDef<LogRow>[]>(
    () => [
      {
        id: SOFTWARE_LOG_COLUMNS.device.id,
        header: SOFTWARE_LOG_COLUMNS.device.header,
        cell: ({ row }: { row: Row<LogRow> }) => <SoftwareLogDeviceCell device={row.original} />,
        enableSorting: false,
        meta: liveColumnMeta(SOFTWARE_LOG_COLUMNS.device),
      },
      {
        id: SOFTWARE_LOG_COLUMNS.customer.id,
        header: SOFTWARE_LOG_COLUMNS.customer.header,
        cell: ({ row }: { row: Row<LogRow> }) => <SoftwareLogCustomerCell device={row.original} />,
        enableSorting: false,
        meta: liveColumnMeta(SOFTWARE_LOG_COLUMNS.customer),
      },
      {
        id: SOFTWARE_LOG_COLUMNS.status.id,
        header: SOFTWARE_LOG_COLUMNS.status.header,
        accessorFn: (row: LogRow) => row.status,
        cell: ({ row }: { row: Row<LogRow> }) => (
          <SoftwareLogStatusCell device={row.original} actionLabel={actionLabel} />
        ),
        enableSorting: false,
        filterFn: multiSelectFilterFn,
        meta: liveColumnMeta(SOFTWARE_LOG_COLUMNS.status, { filter: { options: statusOptions } }),
      },
      {
        id: SOFTWARE_LOG_COLUMNS.result.id,
        cell: ({ row }: { row: Row<LogRow> }) => <SoftwareLogResultToggleCell id={row.original.machineId} />,
        enableSorting: false,
        meta: liveColumnMeta(SOFTWARE_LOG_COLUMNS.result),
      },
    ],
    [actionLabel, statusOptions],
  );

  const { columnFilters, onColumnFiltersChange } = singleColumnFilter(SOFTWARE_LOG_COLUMNS.status.id, ticked, status =>
    onFilterChange({ status }),
  );

  const table = useDataTable<LogRow>({
    data: logs,
    columns,
    getRowId,
    enableSorting: false,
    state: { columnFilters },
    onColumnFiltersChange,
  });

  const renderSubRow = (row: LogRow) => {
    const phase = phases.get(row.machineId);
    if (!phase) return null;
    return (
      <SoftwareLogResultPanel device={row} expanded={phase === 'open'} onCollapsed={() => collapsed(row.machineId)} />
    );
  };

  // An open row sits on the page ground, cells and output alike.
  const rowClassName = (row: LogRow) =>
    cn(
      'transition-colors duration-200 motion-reduce:transition-none',
      phases.get(row.machineId) === 'open' && 'bg-ods-bg',
    );

  // Header, empty copy and the toolbar hand-off follow the script Execution
  // History table (`executions-table.tsx`), which reasons through each case.
  const hasActiveFilter = columnFilters.length > 0;
  const showHeader = loading || logs.length > 0 || hasActiveFilter || isPending;

  const resolvedEmptyState: NoDataProps =
    narrowSearch || hasActiveFilter
      ? {
          icon: <SearchIcon />,
          title: 'No logs found',
          description: narrowSearch
            ? `Nothing matches "${narrowSearch}". Try adjusting your search or filters.`
            : 'Try adjusting your filters.',
        }
      : EMPTY_STATE;

  const isEmptyState = !loading && logs.length === 0 && !narrowSearch && !hasActiveFilter && !isPending;
  useEffect(() => {
    onEmptyChange(isEmptyState);
  }, [isEmptyState, onEmptyChange]);
  useEffect(() => () => onEmptyChange(false), [onEmptyChange]);

  return (
    <ResultPhasesContext.Provider value={{ phases, toggle }}>
      <LiveTable
        table={table}
        pageSize={PLACEHOLDER_ROW_COUNT}
        loadingCells={loading}
        stickyHeaderOffset={stickyHeaderOffset}
        showHeader={showHeader}
        itemName="result"
        isPending={isPending}
        emptyState={resolvedEmptyState}
        rowClassName={rowClassName}
        renderSubRow={renderSubRow}
        footer={null}
      />

      <FilterModal
        isOpen={mobileFilterOpen}
        onClose={onMobileFilterClose}
        filterGroups={[{ id: SOFTWARE_LOG_COLUMNS.status.id, title: 'Status', options: statusOptions }]}
        onFilterChange={onFilterChange}
        currentFilters={{ status: ticked }}
      />
    </ResultPhasesContext.Provider>
  );
}
