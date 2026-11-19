'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { MonitorIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  type AutoRefreshControlProps,
  type ColumnDef,
  type DataTableSortState,
  type Row,
  useDataTable,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import type {
  CursorPagerFooterProps,
  CursorPagerVariables,
  UseCursorPagerReturn,
} from '@flamingo-stack/openframe-frontend-core/hooks';
import { useEffect, useMemo } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type {
  SoftwareOnDeviceFilterInput,
  softwareDevicesTableQuery as SoftwareDevicesTableQueryType,
  softwareDevicesTableQuery$data,
  SortInput,
} from '@/__generated__/softwareDevicesTableQuery.graphql';
import { EmptyState, liveColumnMeta, NO_ITEMS, oneLineEmptyState, useRetryKey } from '@/app/components/shared';
import { LiveTable, loadingPlaceholderRows } from '@/app/components/shared/live-table';
import { OpenRowButton } from '@/app/components/shared/open-row-button';
import { StaleCursorBoundary } from '@/app/components/shared/stale-cursor-boundary';
import { forwardPage } from '@/app/hooks/forward-page';
import { usePagedTable } from '@/app/hooks/use-paged-table';
import { useRefetchPage } from '@/app/hooks/use-refetch-page';
import { openInNewTab } from '@/lib/open-in-new-tab';
import { routes } from '@/lib/routes';
import { multiSelectFilterFn } from '@/lib/table-filters';
import { singleColumnFilter } from '../../shared/column-filters';
import { SoftwareDeviceAutoUpdateCell } from './software-device-auto-update-cell';
import { SoftwareDeviceCell } from './software-device-cell';
import { SoftwareDeviceInstalledByCell } from './software-device-installed-by-cell';
import { SoftwareDeviceVersionCell } from './software-device-version-cell';
import { SOFTWARE_DEVICE_COLUMNS, SOFTWARE_DEVICES_PAGE_SIZE } from './software-devices-columns';
import { SOFTWARE_ON_DEVICE_STATUS_OPTIONS } from './software-on-device-status';

/**
 * Software → Devices: the machines carrying this title, each with its OWN
 * installed version and per-device status (OUTDATED / SCHEDULED_UPDATE / …).
 * The Status funnel offers the states the backend can report — a fixed list,
 * see `SOFTWARE_ON_DEVICE_STATUS_OPTIONS`. One page at a time, its cursor in the
 * URL (`deviceCursor`; no `@connection`: a cursor from a link must read exactly
 * its page).
 */
const softwareDevicesTableQuery = graphql`
  query softwareDevicesTableQuery(
    $softwareId: ID!
    $filter: SoftwareOnDeviceFilterInput
    $search: String
    $sort: SortInput
    $first: Int!
    $after: String
  ) {
    softwareDevices(
      softwareId: $softwareId
      filter: $filter
      search: $search
      sort: $sort
      first: $first
      after: $after
    ) {
      filteredCount
      edges {
        node {
          # What the status funnel narrows the rows on screen by, while the
          # refetch it triggered is still in flight.
          status
          device {
            id
            machineId
            ...softwareDeviceCell_machine
          }
          ...softwareDeviceVersionCell_softwareOnDevice
          ...softwareDeviceInstalledByCell_softwareOnDevice
          ...softwareDeviceAutoUpdateCell_softwareOnDevice
        }
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
    }
  }
`;

type SoftwareDeviceRow = NonNullable<softwareDevicesTableQuery$data['softwareDevices']>['edges'][number]['node'];

/**
 * The device's page — by its agent machine id, or the global id for a device with no agent yet. A loading placeholder
 * (`loadingPlaceholderRows`) has no device yet, and no page.
 */
function deviceHref(row: SoftwareDeviceRow): string | null {
  const { device } = row as Partial<SoftwareDeviceRow>;
  return device ? routes.devices.details(device.machineId || device.id) : null;
}

/** The columns, with the Status funnel over the states the backend reports. */
function buildColumns(): ColumnDef<SoftwareDeviceRow>[] {
  return [
    {
      id: SOFTWARE_DEVICE_COLUMNS.device.id,
      header: SOFTWARE_DEVICE_COLUMNS.device.header,
      cell: ({ row }: { row: Row<SoftwareDeviceRow> }) => <SoftwareDeviceCell machine={row.original.device} />,
      enableSorting: false,
      meta: liveColumnMeta(SOFTWARE_DEVICE_COLUMNS.device),
    },
    {
      // Column id is the backend sort field, as everywhere else in the app.
      id: SOFTWARE_DEVICE_COLUMNS.softwareVersion.id,
      header: SOFTWARE_DEVICE_COLUMNS.softwareVersion.header,
      accessorFn: (row: SoftwareDeviceRow) => row.status ?? '',
      cell: ({ row }: { row: Row<SoftwareDeviceRow> }) => <SoftwareDeviceVersionCell softwareOnDevice={row.original} />,
      enableSorting: false,
      filterFn: multiSelectFilterFn,
      meta: liveColumnMeta(SOFTWARE_DEVICE_COLUMNS.softwareVersion, {
        // The column stretches to the row's end, so an end-anchored popover would
        // hang off the far right, nowhere near the header it belongs to.
        filter: { options: SOFTWARE_ON_DEVICE_STATUS_OPTIONS },
      }),
    },
    {
      id: SOFTWARE_DEVICE_COLUMNS.installedBy.id,
      header: SOFTWARE_DEVICE_COLUMNS.installedBy.header,
      cell: ({ row }: { row: Row<SoftwareDeviceRow> }) => (
        <SoftwareDeviceInstalledByCell softwareOnDevice={row.original} />
      ),
      enableSorting: false,
      meta: liveColumnMeta(SOFTWARE_DEVICE_COLUMNS.installedBy),
    },
    {
      id: SOFTWARE_DEVICE_COLUMNS.autoUpdate.id,
      header: SOFTWARE_DEVICE_COLUMNS.autoUpdate.header,
      cell: ({ row }: { row: Row<SoftwareDeviceRow> }) => (
        <SoftwareDeviceAutoUpdateCell softwareOnDevice={row.original} />
      ),
      enableSorting: false,
      meta: liveColumnMeta(SOFTWARE_DEVICE_COLUMNS.autoUpdate),
    },
    {
      id: SOFTWARE_DEVICE_COLUMNS.open.id,
      cell: ({ row }: { row: Row<SoftwareDeviceRow> }) => {
        // A loading placeholder row (or a device with no address) has nothing to open: the button is inert.
        const href = deviceHref(row.original);
        return <OpenRowButton label="Open device in new tab" onClick={openInNewTab(href ?? '')} disabled={!href} />;
      },
      enableSorting: false,
      meta: liveColumnMeta(SOFTWARE_DEVICE_COLUMNS.open),
    },
  ];
}

/**
 * TEMPORARY (frontend-side workaround, remove with the backend fix): the same
 * Machine can come back on two rows of `softwareDevices` (seen on test-env),
 * and a key on the device alone makes React drop or duplicate one of them.
 * The row's position tells the two apart until the backend either dedupes the
 * rows or gives `SoftwareOnDevice` an id of its own — then this goes back to
 * `row.device.id`. Position is a safe tiebreaker here and nowhere else: the
 * table only ever shows one page, and a page, sort or funnel change rebuilds it
 * whole.
 */
const getRowId = (row: SoftwareDeviceRow, index: number) =>
  // A loading placeholder (`loadingPlaceholderRows`) has no device yet: it keys on its own id.
  `${(row as Partial<SoftwareDeviceRow>).device?.id ?? (row as { id?: string }).id}\0${index}`;

interface SoftwareDevicesTableProps {
  softwareId: string;
  backendFilters: SoftwareOnDeviceFilterInput | null;
  debouncedSearch: string;
  sort: SortInput | null;
  sortState: DataTableSortState | null;
  onSortChange: (columnId: string) => void;
  statusFilter: string[];
  onStatusFilterChange: (values: string[]) => void;
  /** True while a refetch is in flight — guards the empty state so it never flashes on stale data. */
  isPending: boolean;
  /** No device carries this title at all (not a search or funnel miss) — the tab drops its toolbar. */
  onEmptyChange: (isEmpty: boolean) => void;
  stickyHeaderOffset: string;
  /** The list's position in the URL: footer props, the stale check, the cursor drop. */
  pager: UseCursorPagerReturn;
  /** Deferred — the page variables to spread into the query (lag the URL while the next page is read). */
  pageVariables: CursorPagerVariables;
  /** The URL prefix of the tab's params (its auto-refresh interval sits beside them). */
  paramPrefix: string;
}

/**
 * The tab's rows, with their own boundary. In a loading scope (the boundary's fallback, or the module's flag window)
 * the reader draws the table over one page of placeholder rows with their real cells, each in its own loading form;
 * otherwise it runs the query, which suspends under that boundary.
 */
export function SoftwareDevicesTable(props: SoftwareDevicesTableProps) {
  return (
    <StaleCursorBoundary cursor={props.pager.cursor} onStaleCursor={props.pager.dropCursor}>
      <SoftwareDevicesTableLoading {...props} />
    </StaleCursorBoundary>
  );
}

/** The rows' loading boundary, the whole output of its own component (the loading standard), under the
 * stale-cursor boundary above. */
function SoftwareDevicesTableLoading(props: SoftwareDevicesTableProps) {
  return (
    <LoadingSuspense label="Loading devices">
      <SoftwareDevicesTableReader {...props} />
    </LoadingSuspense>
  );
}

function SoftwareDevicesTableReader(props: SoftwareDevicesTableProps) {
  if (useLoadingScope()) {
    return <SoftwareDevicesTableRows {...props} rows={NO_ITEMS} totalCount={0} pager={null} />;
  }
  return <SoftwareDevicesTableQuery {...props} />;
}

function SoftwareDevicesTableQuery(props: SoftwareDevicesTableProps) {
  const { softwareId, backendFilters, debouncedSearch, sort, isPending, pager, pageVariables, paramPrefix } = props;
  const retryKey = useRetryKey();
  const variables = {
    softwareId,
    filter: backendFilters,
    search: debouncedSearch || null,
    sort,
    ...forwardPage(pageVariables, SOFTWARE_DEVICES_PAGE_SIZE),
  };
  const data = useLazyLoadQuery<SoftwareDevicesTableQueryType>(softwareDevicesTableQuery, variables, {
    fetchPolicy: 'store-or-network',
    fetchKey: retryKey,
  });
  const refetch = useRefetchPage<SoftwareDevicesTableQueryType>(softwareDevicesTableQuery, variables);

  const rows = (data.softwareDevices?.edges ?? []).map(edge => edge.node);
  const totalCount = data.softwareDevices?.filteredCount ?? rows.length;
  const paged = usePagedTable({
    pager,
    pageInfo: data.softwareDevices?.pageInfo,
    rowCount: rows.length,
    prefix: paramPrefix,
    refetch,
    isPending,
  });

  return (
    <SoftwareDevicesTableRows
      {...props}
      rows={rows}
      totalCount={totalCount}
      pager={paged.pager}
      refresh={paged.refresh}
    />
  );
}

interface SoftwareDevicesTableRowsProps extends Omit<
  SoftwareDevicesTableProps,
  'pager' | 'pageVariables' | 'paramPrefix'
> {
  rows: readonly SoftwareDeviceRow[];
  totalCount: number;
  /** The First · Prev · Next footer (`usePagedTable`); `null` while the first page is read. */
  pager: CursorPagerFooterProps | null;
  /** The auto-refresh picker in the header (`usePagedTable`). */
  refresh?: AutoRefreshControlProps;
}

/** The table itself, from the rows it is handed: no query, so it also draws in a loading scope. */
function SoftwareDevicesTableRows({
  rows,
  totalCount,
  pager,
  refresh,
  backendFilters,
  debouncedSearch,
  sortState,
  onSortChange,
  statusFilter,
  onStatusFilterChange,
  isPending,
  onEmptyChange,
  stickyHeaderOffset,
}: SoftwareDevicesTableRowsProps) {
  const loading = useLoadingScope();

  const { columnFilters, onColumnFiltersChange } = singleColumnFilter(
    SOFTWARE_DEVICE_COLUMNS.softwareVersion.id,
    statusFilter,
    onStatusFilterChange,
  );

  // While the page is read the table holds one page of placeholder rows, drawn with their real cells.
  const placeholderRows = useMemo(
    () => (loading ? loadingPlaceholderRows<SoftwareDeviceRow>(SOFTWARE_DEVICES_PAGE_SIZE) : null),
    [loading],
  );

  const table = useDataTable<SoftwareDeviceRow>({
    // The table only ever reads the page it is handed.
    data: placeholderRows ?? (rows as SoftwareDeviceRow[]),
    columns: buildColumns(),
    getRowId,
    enableSorting: false,
    state: { columnFilters },
    onColumnFiltersChange,
  });

  // A search or a funnel that finds nothing keeps the table (its own "no match"
  // row); a title on no device at all gets the section's empty state instead. An empty LATER page keeps the table, so
  // First stays reachable.
  const showEmptyState =
    !loading && !debouncedSearch && !backendFilters && !isPending && rows.length === 0 && (pager?.isFirstPage ?? true);

  useEffect(() => {
    onEmptyChange(showEmptyState);
  }, [showEmptyState, onEmptyChange]);

  if (showEmptyState) {
    return (
      <EmptyState
        icon={<MonitorIcon />}
        title="No devices"
        description="Devices with this software installed will be listed here once they report their inventory."
      />
    );
  }

  return (
    <LiveTable
      table={table}
      pageSize={SOFTWARE_DEVICES_PAGE_SIZE}
      loadingCells={loading}
      stickyHeaderOffset={stickyHeaderOffset}
      itemName="result"
      totalCount={totalCount}
      sort={sortState}
      onSortChange={onSortChange}
      isPending={isPending}
      emptyState={oneLineEmptyState(
        debouncedSearch
          ? `No devices found matching "${debouncedSearch}". Try adjusting your search.`
          : 'No devices with the selected status. Try adjusting your filter.',
      )}
      rowHref={deviceHref}
      pager={pager}
      refresh={refresh}
    />
  );
}
