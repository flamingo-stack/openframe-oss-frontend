'use client';

import { Tag } from '@flamingo-stack/openframe-frontend-core';
import { ArrowRightUpIcon, MonitorIcon, SearchIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Button,
  type ColumnDef,
  DataTable,
  type DataTableSortState,
  Input,
  type Row,
  TruncateText,
  useDataTable,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useApiParams } from '@flamingo-stack/openframe-frontend-core/hooks';
import { memo, Suspense, useCallback, useMemo } from 'react';
import { useLazyLoadQuery, usePaginationFragment } from 'react-relay';
import type { softwareDevicesRelay_query$key as SoftwareDevicesFragmentKey } from '@/__generated__/softwareDevicesRelay_query.graphql';
import type { softwareDevicesRelayPaginationQuery as SoftwareDevicesPaginationQueryType } from '@/__generated__/softwareDevicesRelayPaginationQuery.graphql';
import type {
  SoftwareOnDeviceFilterInput,
  softwareDevicesRelayQuery as SoftwareDevicesQueryType,
  SortInput,
} from '@/__generated__/softwareDevicesRelayQuery.graphql';
import type { Device } from '@/app/(app)/devices/types/device.types';
import { getDeviceStatusConfig } from '@/app/(app)/devices/utils/device-status';
import { machineRowToDevice } from '@/app/(app)/devices/utils/device-transform';
import { liveColumnMeta, skeletonColumnDefs, useRetryKey } from '@/app/components/shared';
import { renderDeviceTypeIcon } from '@/app/components/shared/device-type-icon';
import { useDeferredQuery } from '@/app/hooks/use-deferred-query';
import { useSearchParam } from '@/app/hooks/use-search-param';
import { useStickyToolbar } from '@/app/hooks/use-sticky-toolbar';
import { SoftwareOnDeviceStatus } from '@/generated/schema-enums';
import { softwareDevicesRelayFragment, softwareDevicesRelayQuery } from '@/graphql/software/software-devices-relay';
import { openInNewTab } from '@/lib/open-in-new-tab';
import { routes } from '@/lib/routes';
import { multiSelectFilterFn } from '@/lib/table-filters';
import { SOFTWARE_DEVICE_COLUMNS, SOFTWARE_DEVICES_TABLE_COLUMNS } from './software-detail-columns';
import { SoftwareOnDeviceStatusTag, toDeviceSoftwareStatus } from './software-tags';

const PAGE_SIZE = 20;

/**
 * TanStack's column-filter state as `useDataTable` hands it back. Declared
 * structurally rather than imported: @tanstack/react-table is the core library's
 * dependency, not this app's, so importing it here would be an undeclared one.
 */
type ColumnFilterState = { id: string; value: unknown }[];

/**
 * The only value allowed to reach `SortInput.field` on this list — anything else
 * in the URL falls back to the backend's own order. Matches the column id of the
 * one sortable header.
 */
const SORTABLE_COLUMN_IDS = ['softwareVersion'] as const;

/** Status funnel options — the per-device lifecycle the chip shows. */
const STATUS_OPTIONS = [
  { id: SoftwareOnDeviceStatus.UP_TO_DATE, label: 'Up to date', value: SoftwareOnDeviceStatus.UP_TO_DATE },
  { id: SoftwareOnDeviceStatus.OUTDATED, label: 'Outdated', value: SoftwareOnDeviceStatus.OUTDATED },
  {
    id: SoftwareOnDeviceStatus.SCHEDULED_UPDATE,
    label: 'Scheduled update',
    value: SoftwareOnDeviceStatus.SCHEDULED_UPDATE,
  },
  { id: SoftwareOnDeviceStatus.UNINSTALLING, label: 'Uninstalling', value: SoftwareOnDeviceStatus.UNINSTALLING },
  {
    id: SoftwareOnDeviceStatus.SCHEDULED_UNINSTALL,
    label: 'Scheduled uninstall',
    value: SoftwareOnDeviceStatus.SCHEDULED_UNINSTALL,
  },
];

interface UiSoftwareDevice {
  /** The machine's Relay global id — the row key. */
  id: string;
  device: Device;
  softwareVersion: string | null;
  status: SoftwareOnDeviceStatus | null;
}

// ----------------------------------------------------------------
// Inner content — Relay hooks, must live inside Suspense
// ----------------------------------------------------------------

interface SoftwareDevicesContentProps {
  softwareId: string;
  backendFilters: SoftwareOnDeviceFilterInput | null;
  debouncedSearch: string;
  sort: SortInput | null;
  sortState: DataTableSortState | null;
  onSortChange: (columnId: string) => void;
  statusFilter: string[];
  onStatusFilterChange: (values: string[]) => void;
  isPending: boolean;
  stickyHeaderOffset: string;
}

function SoftwareDevicesContent({
  softwareId,
  backendFilters,
  debouncedSearch,
  sort,
  sortState,
  onSortChange,
  statusFilter,
  onStatusFilterChange,
  isPending,
  stickyHeaderOffset,
}: SoftwareDevicesContentProps) {
  const retryKey = useRetryKey();

  const variables = useMemo(
    () => ({
      softwareId,
      filter: backendFilters,
      search: debouncedSearch || null,
      sort,
      first: PAGE_SIZE,
      after: null,
    }),
    [softwareId, backendFilters, debouncedSearch, sort],
  );

  const queryData = useLazyLoadQuery<SoftwareDevicesQueryType>(softwareDevicesRelayQuery, variables, {
    fetchPolicy: 'store-and-network',
    fetchKey: retryKey,
  });

  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    SoftwareDevicesPaginationQueryType,
    SoftwareDevicesFragmentKey
  >(softwareDevicesRelayFragment, queryData);

  const rows: UiSoftwareDevice[] = useMemo(() => {
    const edges = data.softwareDevices?.edges ?? [];
    return edges.flatMap(edge => {
      const node = edge?.node;
      if (!node) return [];
      const device = machineRowToDevice(node.device);
      return [
        {
          id: device.id,
          device,
          softwareVersion: node.softwareVersion ?? null,
          status: toDeviceSoftwareStatus(node.status),
        },
      ];
    });
  }, [data.softwareDevices?.edges]);

  const totalCount = data.softwareDevices?.filteredCount ?? rows.length;

  const fetchNextPage = useCallback(() => {
    if (hasNext && !isLoadingNext) {
      loadNext(PAGE_SIZE);
    }
  }, [hasNext, isLoadingNext, loadNext]);

  const columns = useMemo<ColumnDef<UiSoftwareDevice>[]>(
    () => [
      {
        accessorKey: 'device',
        header: SOFTWARE_DEVICE_COLUMNS.device.header,
        cell: ({ row }: { row: Row<UiSoftwareDevice> }) => {
          const { device } = row.original;
          const statusConfig = getDeviceStatusConfig(device.status ?? '');
          return (
            <div className="flex min-w-0 items-center gap-[var(--spacing-system-m)]">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-ods-border">
                {renderDeviceTypeIcon(device.type, 'h-4 w-4 text-ods-text-secondary') ?? (
                  <MonitorIcon className="h-4 w-4 text-ods-text-secondary" />
                )}
              </span>
              <div className="flex min-w-0 flex-col justify-center">
                <div className="flex min-w-0 items-center gap-[var(--spacing-system-xxs)]">
                  <TruncateText>{device.displayName || device.hostname || '—'}</TruncateText>
                  {device.status && <Tag label={statusConfig.label} variant={statusConfig.variant} />}
                </div>
                {device.organization && (
                  <TruncateText variant="h6" tone="secondary">
                    {device.organization}
                  </TruncateText>
                )}
              </div>
            </div>
          );
        },
        enableSorting: false,
        meta: liveColumnMeta(SOFTWARE_DEVICE_COLUMNS.device),
      },
      {
        // Column id is the backend sort field, as everywhere else in the app.
        id: 'softwareVersion',
        header: SOFTWARE_DEVICE_COLUMNS.softwareVersion.header,
        accessorFn: (row: UiSoftwareDevice) => row.status ?? '',
        cell: ({ row }: { row: Row<UiSoftwareDevice> }) => (
          <div className="flex min-w-0 items-center gap-[var(--spacing-system-xxs)]">
            <TruncateText>{row.original.softwareVersion ?? '—'}</TruncateText>
            <SoftwareOnDeviceStatusTag status={row.original.status} />
          </div>
        ),
        enableSorting: false,
        filterFn: multiSelectFilterFn,
        meta: liveColumnMeta(SOFTWARE_DEVICE_COLUMNS.softwareVersion, {
          filter: { options: STATUS_OPTIONS, placement: 'bottom-end' },
        }),
      },
      {
        id: 'open',
        cell: ({ row }: { row: Row<UiSoftwareDevice> }) => {
          const { device } = row.original;
          return (
            <div data-no-row-click className="pointer-events-auto flex items-center justify-end">
              <Button
                onClick={openInNewTab(routes.devices.details(device.machineId || device.id))}
                variant="outline"
                size="icon"
                leftIcon={<ArrowRightUpIcon className="h-5 w-5" />}
                aria-label="Open device in new tab"
                className="bg-ods-card"
              />
            </div>
          );
        },
        enableSorting: false,
        meta: liveColumnMeta(SOFTWARE_DEVICE_COLUMNS.open),
      },
    ],
    [],
  );

  const columnFilters = useMemo<ColumnFilterState>(
    () => (statusFilter.length > 0 ? [{ id: 'softwareVersion', value: statusFilter }] : []),
    [statusFilter],
  );

  const handleColumnFiltersChange = useCallback(
    // TanStack's updater signature: either the next state or a reducer over it.
    (updater: ColumnFilterState | ((prev: ColumnFilterState) => ColumnFilterState)) => {
      const next = typeof updater === 'function' ? updater(columnFilters) : updater;
      const values = next.find(f => f.id === 'softwareVersion')?.value;
      onStatusFilterChange(Array.isArray(values) ? (values as string[]) : []);
    },
    [columnFilters, onStatusFilterChange],
  );

  const table = useDataTable<UiSoftwareDevice>({
    data: rows,
    columns,
    getRowId: (row: UiSoftwareDevice) => row.id,
    enableSorting: false,
    state: { columnFilters },
    onColumnFiltersChange: handleColumnFiltersChange,
  });

  const rowHref = useCallback(
    (row: UiSoftwareDevice) => routes.devices.details(row.device.machineId || row.device.id),
    [],
  );

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
          skeletonRows={PAGE_SIZE}
          emptyMessage={
            debouncedSearch
              ? `No devices found matching "${debouncedSearch}". Try adjusting your search.`
              : 'No devices have this software installed.'
          }
          rowClassName="mb-1"
          rowHref={rowHref}
          autoHeight
        />
        <DataTable.InfiniteFooter
          hasNextPage={hasNext}
          isFetchingNextPage={isLoadingNext}
          onLoadMore={fetchNextPage}
          skeletonRows={2}
        />
      </DataTable>
    </div>
  );
}

// ----------------------------------------------------------------
// Loading skeleton
// ----------------------------------------------------------------

const EMPTY_ROWS: UiSoftwareDevice[] = [];

function SoftwareDevicesSkeleton({ stickyHeaderOffset }: { stickyHeaderOffset: string }) {
  const columns = useMemo<ColumnDef<UiSoftwareDevice>[]>(
    () => skeletonColumnDefs<UiSoftwareDevice>(SOFTWARE_DEVICES_TABLE_COLUMNS),
    [],
  );

  const table = useDataTable<UiSoftwareDevice>({
    data: EMPTY_ROWS,
    columns,
    getRowId: (row: UiSoftwareDevice) => row.id,
    enableSorting: false,
  });

  return (
    <DataTable table={table}>
      <DataTable.Header stickyHeader stickyHeaderOffset={stickyHeaderOffset} />
      <DataTable.Body loading={true} skeletonRows={PAGE_SIZE} emptyMessage="" rowClassName="mb-1" />
    </DataTable>
  );
}

// ----------------------------------------------------------------
// Tab shell — URL state + Suspense boundary
// ----------------------------------------------------------------

export interface SoftwareTabProps {
  softwareId: string;
  softwareName: string;
}

/**
 * Software → Devices: every machine carrying this title, with its own installed
 * version and lifecycle status.
 */
export const SoftwareDevicesTab = memo(function SoftwareDevicesTabImpl({ softwareId }: SoftwareTabProps) {
  const { params, setParam, setParams } = useApiParams({
    deviceSearch: { type: 'string', default: '' },
    deviceStatus: { type: 'array', default: [] },
    deviceSortBy: { type: 'string', default: '' },
    deviceSortDir: { type: 'string', default: 'desc' },
  });

  const {
    search: searchInput,
    setSearch: setSearchInput,
    debouncedSearch,
  } = useSearchParam(params.deviceSearch, value => setParam('deviceSearch', value), 300);

  const { toolbarRef, containerStyle, stickyHeaderOffset } = useStickyToolbar();

  const backendFilters = useMemo<SoftwareOnDeviceFilterInput | null>(
    () =>
      params.deviceStatus.length > 0
        ? { statuses: params.deviceStatus as SoftwareOnDeviceFilterInput['statuses'] }
        : null,
    [params.deviceStatus],
  );

  // A hand-edited or stale `?deviceSortBy=` would otherwise travel straight into
  // `SortInput.field` and surface as a GraphQL error inside the boundary.
  const sortBy = (SORTABLE_COLUMN_IDS as readonly string[]).includes(params.deviceSortBy) ? params.deviceSortBy : '';

  const sortInput = useMemo<SortInput | null>(
    () => (sortBy ? { field: sortBy, direction: params.deviceSortDir === 'asc' ? 'ASC' : 'DESC' } : null),
    [sortBy, params.deviceSortDir],
  );

  const sortState = useMemo<DataTableSortState | null>(
    () => (sortBy ? { id: sortBy, desc: params.deviceSortDir !== 'asc' } : null),
    [sortBy, params.deviceSortDir],
  );

  const queryVars = useMemo(() => ({ filter: backendFilters, sort: sortInput }), [backendFilters, sortInput]);
  const { deferredFilters: deferredVars, deferredSearch, isPending } = useDeferredQuery(queryVars, debouncedSearch);

  // 3-state toggle owned by the consumer (per DataTable.Header contract):
  // unsorted → desc → asc → unsorted. `deviceSortDir: ''` — not `'desc'` —
  // whenever the direction is the default one, so the URL drops the param.
  const handleSortChange = useCallback(
    (columnId: string) => {
      if (sortBy !== columnId) {
        setParams({ deviceSortBy: columnId, deviceSortDir: '' });
      } else if (params.deviceSortDir === 'desc') {
        setParams({ deviceSortDir: 'asc' });
      } else {
        setParams({ deviceSortBy: '', deviceSortDir: '' });
      }
      document.querySelector('main')?.scrollTo({ top: 0, behavior: 'instant' });
    },
    [sortBy, params.deviceSortDir, setParams],
  );

  const handleStatusFilterChange = useCallback((values: string[]) => setParam('deviceStatus', values), [setParam]);

  return (
    <div className="flex flex-col pt-[var(--spacing-system-l)]" style={containerStyle}>
      <div
        ref={toolbarRef}
        className="sticky top-0 z-20 -mx-[var(--spacing-system-l)] -mt-[var(--spacing-system-l)] flex items-center gap-[var(--spacing-system-m)] bg-ods-bg p-[var(--spacing-system-l)]"
      >
        <Input
          placeholder="Search for Devices"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          className="flex-1"
          startAdornment={<SearchIcon className="h-4 w-4 md:h-6 md:w-6" />}
        />
      </div>

      <Suspense fallback={<SoftwareDevicesSkeleton stickyHeaderOffset={stickyHeaderOffset} />}>
        <SoftwareDevicesContent
          softwareId={softwareId}
          backendFilters={deferredVars.filter}
          debouncedSearch={deferredSearch}
          sort={deferredVars.sort}
          sortState={sortState}
          onSortChange={handleSortChange}
          statusFilter={params.deviceStatus}
          onStatusFilterChange={handleStatusFilterChange}
          isPending={isPending}
          stickyHeaderOffset={stickyHeaderOffset}
        />
      </Suspense>
    </div>
  );
});
SoftwareDevicesTab.displayName = 'SoftwareDevicesTab';
