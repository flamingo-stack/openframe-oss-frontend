'use client';

import { MonitorIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  type ColumnDef,
  type DataTableSortState,
  type Row,
  useDataTable,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useEffect, useMemo } from 'react';
import { graphql, useLazyLoadQuery, usePaginationFragment } from 'react-relay';
import type {
  softwareDevicesTable_query$data,
  softwareDevicesTable_query$key,
} from '@/__generated__/softwareDevicesTable_query.graphql';
import type { softwareDevicesTablePaginationQuery as SoftwareDevicesTablePaginationQueryType } from '@/__generated__/softwareDevicesTablePaginationQuery.graphql';
import type {
  SoftwareOnDeviceFilterInput,
  softwareDevicesTableQuery as SoftwareDevicesTableQueryType,
  SortInput,
} from '@/__generated__/softwareDevicesTableQuery.graphql';
import {
  EmptyState,
  type InfiniteScroll,
  liveColumnMeta,
  NO_ITEMS,
  NO_NEXT_PAGE,
  useRetryKey,
} from '@/app/components/shared';
import { LiveTable, loadingPlaceholderRows, emptyMessage } from '@/app/components/shared/live-table';
import { openInNewTab } from '@/lib/open-in-new-tab';
import { routes } from '@/lib/routes';
import { multiSelectFilterFn } from '@/lib/table-filters';
import { singleColumnFilter } from '../../shared/column-filters';
import { OpenRowButton } from '../../shared/open-row-button';
import { SoftwareDeviceCell } from './software-device-cell';
import { SoftwareDeviceVersionCell } from './software-device-version-cell';
import { SOFTWARE_DEVICE_COLUMNS, SOFTWARE_DEVICES_PAGE_SIZE } from './software-devices-columns';
import { SOFTWARE_ON_DEVICE_STATUS_OPTIONS } from './software-on-device-status';

/**
 * Software → Devices: the machines carrying this title, each with its OWN
 * installed version and per-device status (OUTDATED / SCHEDULED_UPDATE / …).
 * The Status funnel offers the states the backend can report — a fixed list,
 * see `SOFTWARE_ON_DEVICE_STATUS_OPTIONS`.
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
    ...softwareDevicesTable_query
      @arguments(softwareId: $softwareId, filter: $filter, search: $search, sort: $sort, first: $first, after: $after)
  }
`;

const softwareDevicesTableFragment = graphql`
  fragment softwareDevicesTable_query on Query
  @refetchable(queryName: "softwareDevicesTablePaginationQuery")
  @argumentDefinitions(
    softwareId: { type: "ID!" }
    filter: { type: "SoftwareOnDeviceFilterInput" }
    search: { type: "String" }
    sort: { type: "SortInput" }
    first: { type: "Int", defaultValue: 20 }
    after: { type: "String" }
  ) {
    softwareDevices(
      softwareId: $softwareId
      filter: $filter
      search: $search
      sort: $sort
      first: $first
      after: $after
    ) @connection(key: "softwareDevicesTable_softwareDevices") {
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
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

type SoftwareDeviceRow = NonNullable<softwareDevicesTable_query$data['softwareDevices']>['edges'][number]['node'];

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
      id: SOFTWARE_DEVICE_COLUMNS.open.id,
      cell: ({ row }: { row: Row<SoftwareDeviceRow> }) => (
        <OpenRowButton label="Open device in new tab" onClick={openInNewTab(deviceHref(row.original) ?? '')} />
      ),
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
 * list only ever appends pages, and a sort or funnel change rebuilds it whole.
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
}

/**
 * The tab's rows. In a loading scope (the tab's Suspense fallback, or the module's flag window) it draws the table
 * over one page of placeholder rows with their real cells, each in its own loading form; otherwise it runs the query, which suspends, so it lives
 * under the tab's `<Suspense>`.
 */
export function SoftwareDevicesTable(props: SoftwareDevicesTableProps) {
  if (useLoadingScope()) {
    return <SoftwareDevicesTableRows {...props} rows={NO_ITEMS} totalCount={0} infiniteScroll={NO_NEXT_PAGE} />;
  }
  return <SoftwareDevicesTableQuery {...props} />;
}

function SoftwareDevicesTableQuery(props: SoftwareDevicesTableProps) {
  const { softwareId, backendFilters, debouncedSearch, sort } = props;
  const retryKey = useRetryKey();
  const queryData = useLazyLoadQuery<SoftwareDevicesTableQueryType>(
    softwareDevicesTableQuery,
    {
      softwareId,
      filter: backendFilters,
      search: debouncedSearch || null,
      sort,
      first: SOFTWARE_DEVICES_PAGE_SIZE,
      after: null,
    },
    { fetchPolicy: 'store-or-network', fetchKey: retryKey },
  );

  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    SoftwareDevicesTablePaginationQueryType,
    softwareDevicesTable_query$key
  >(softwareDevicesTableFragment, queryData);

  const rows = (data.softwareDevices?.edges ?? []).map(edge => edge.node);
  const totalCount = data.softwareDevices?.filteredCount ?? rows.length;

  const fetchNextPage = () => {
    if (hasNext && !isLoadingNext) loadNext(SOFTWARE_DEVICES_PAGE_SIZE);
  };

  return (
    <SoftwareDevicesTableRows
      {...props}
      rows={rows}
      totalCount={totalCount}
      infiniteScroll={{ hasNextPage: hasNext, isFetchingNextPage: isLoadingNext, onLoadMore: fetchNextPage }}
    />
  );
}

interface SoftwareDevicesTableRowsProps extends SoftwareDevicesTableProps {
  rows: readonly SoftwareDeviceRow[];
  totalCount: number;
  infiniteScroll: InfiniteScroll;
}

/** The table itself, from the rows it is handed: no query, so it also draws in a loading scope. */
function SoftwareDevicesTableRows({
  rows,
  totalCount,
  infiniteScroll,
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
  // row); a title on no device at all gets the section's empty state instead.
  const showEmptyState = !loading && !debouncedSearch && !backendFilters && !isPending && rows.length === 0;

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
      emptyState={emptyMessage(
        debouncedSearch
          ? `No devices found matching "${debouncedSearch}". Try adjusting your search.`
          : 'No devices with the selected status. Try adjusting your filter.',
      )}
      rowHref={deviceHref}
      // Zero rows plus a next page: see vulnerability-table.tsx.
      footer={rows.length > 0 ? infiniteScroll : null}
    />
  );
}
