'use client';

import { MonitorIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  type ColumnDef,
  DataTable,
  type DataTableFilterOption,
  type DataTableSortState,
  type Row,
  useDataTable,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useEffect } from 'react';
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
import { EmptyState, liveColumnMeta, useRetryKey } from '@/app/components/shared';
import { openInNewTab } from '@/lib/open-in-new-tab';
import { routes } from '@/lib/routes';
import { multiSelectFilterFn } from '@/lib/table-filters';
import { singleColumnFilter } from '../../shared/column-filters';
import { OpenRowButton } from '../../shared/open-row-button';
import { SoftwareDeviceCell } from './software-device-cell';
import { SoftwareDeviceVersionCell } from './software-device-version-cell';
import { SOFTWARE_DEVICE_COLUMNS, SOFTWARE_DEVICES_PAGE_SIZE } from './software-devices-columns';
import { useSoftwareDeviceFilters } from './use-software-device-filters';

/**
 * Software → Devices: the machines carrying this title, each with its OWN
 * installed version and per-device status (OUTDATED / SCHEDULED_UPDATE / …).
 * The Status funnel offers the states that actually occur among them, with
 * counts, from `softwareDeviceFilters`.
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

/** The device's page — by its agent machine id, or the global id for a device with no agent yet. */
function deviceHref(row: SoftwareDeviceRow): string {
  return routes.devices.details(row.device.machineId || row.device.id);
}

/** The columns, with the Status funnel offering exactly the states this title's devices are in. */
function buildColumns(statusOptions: DataTableFilterOption[]): ColumnDef<SoftwareDeviceRow>[] {
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
        filter: { options: statusOptions },
      }),
    },
    {
      id: SOFTWARE_DEVICE_COLUMNS.open.id,
      cell: ({ row }: { row: Row<SoftwareDeviceRow> }) => (
        <OpenRowButton label="Open device in new tab" onClick={openInNewTab(deviceHref(row.original))} />
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
const getRowId = (row: SoftwareDeviceRow, index: number) => `${row.device.id}\0${index}`;

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

/** The Devices tab's rows — suspends on the query, so it lives under the tab's `<Suspense>`. */
export function SoftwareDevicesTable({
  softwareId,
  backendFilters,
  debouncedSearch,
  sort,
  sortState,
  onSortChange,
  statusFilter,
  onStatusFilterChange,
  isPending,
  onEmptyChange,
  stickyHeaderOffset,
}: SoftwareDevicesTableProps) {
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
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
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

  const { columnFilters, onColumnFiltersChange } = singleColumnFilter(
    SOFTWARE_DEVICE_COLUMNS.softwareVersion.id,
    statusFilter,
    onStatusFilterChange,
  );

  // The funnel's options: what actually occurs among this title's devices, from
  // the server, so a state no device is in is never offered.
  const statusOptions = useSoftwareDeviceFilters(softwareId);

  const table = useDataTable<SoftwareDeviceRow>({
    data: rows,
    columns: buildColumns(statusOptions),
    getRowId,
    enableSorting: false,
    state: { columnFilters },
    onColumnFiltersChange,
  });

  // A search or a funnel that finds nothing keeps the table (its own "no match"
  // row); a title on no device at all gets the section's empty state instead.
  const showEmptyState = !debouncedSearch && !backendFilters && !isPending && rows.length === 0;

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
    <div className={`transition-opacity duration-200 ${isPending ? 'opacity-60' : ''}`}>
      <DataTable table={table}>
        <DataTable.Header
          stickyHeader
          stickyHeaderOffset={stickyHeaderOffset}
          rightSlot={<DataTable.RowCount itemName="result" totalCount={totalCount} />}
          sort={sortState}
          onSortChange={onSortChange}
        />
        <DataTable.Body
          skeletonRows={SOFTWARE_DEVICES_PAGE_SIZE}
          emptyMessage={
            debouncedSearch
              ? `No devices found matching "${debouncedSearch}". Try adjusting your search.`
              : 'No devices with the selected status. Try adjusting your filter.'
          }
          rowClassName="mb-1"
          rowHref={deviceHref}
        />
        {/* Zero rows plus a next page: see vulnerability-list-table.tsx. */}
        {rows.length > 0 && (
          <DataTable.InfiniteFooter
            hasNextPage={hasNext}
            isFetchingNextPage={isLoadingNext}
            onLoadMore={fetchNextPage}
            skeletonRows={2}
          />
        )}
      </DataTable>
    </div>
  );
}
