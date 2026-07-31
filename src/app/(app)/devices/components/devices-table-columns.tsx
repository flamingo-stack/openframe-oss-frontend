import { type DeviceType, getDeviceTypeIcon } from '@flamingo-stack/openframe-frontend-core';
import { OSTypeBadge } from '@flamingo-stack/openframe-frontend-core/components/features';
import { ArrowRightUpIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Button,
  type ColumnDef,
  type ColumnFiltersState,
  DataTable,
  EntityImage,
  type NoDataProps,
  type OnChangeFn,
  type Row,
  Tag,
  TruncateText,
  useDataTable,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import type React from 'react';
import { type ReactNode, useMemo } from 'react';
import { deduplicateFilterOptions } from '@/lib/filter-utils';
import { formatDateTime } from '@/lib/format-date';
import { getFullImageUrl } from '@/lib/image-url';
import { openInNewTab } from '@/lib/open-in-new-tab';
import { routes } from '@/lib/routes';
import { DEFAULT_VISIBLE_STATUSES } from '../constants/device-statuses';
import type { Device, DeviceFilters } from '../types/device.types';
import { getDeviceName } from '../utils/device-name';
import { getDeviceStatusConfig } from '../utils/device-status';
import { DeviceActionsDropdown } from './device-actions-dropdown';

// Returns render function for custom actions area (three dots menu only)
export function getDeviceTableRowActions(onRefresh?: () => void): (device: Device) => React.ReactNode {
  const DeviceRowActions = (device: Device) => (
    <DeviceActionsDropdown device={device} context="table" onActionComplete={onRefresh} />
  );
  DeviceRowActions.displayName = 'DeviceRowActions';
  return DeviceRowActions;
}

export const deviceRowHref = (device: Device): string => routes.devices.details(device.machineId || device.id);

export const DEVICE_OPEN_COLUMN: ColumnDef<Device> = {
  id: 'open',
  cell: ({ row }: { row: Row<Device> }) => (
    <div data-no-row-click className="flex items-center justify-end pointer-events-auto">
      <Button
        onClick={openInNewTab(deviceRowHref(row.original))}
        variant="outline"
        size="icon"
        leftIcon={<ArrowRightUpIcon className="w-5 h-5" />}
        aria-label="Open in new tab"
        className="bg-ods-card"
      />
    </div>
  ),
  enableSorting: false,
  meta: { width: 'w-12 shrink-0 flex-none', hideAt: 'md', align: 'right' },
};

interface DevicesTableBodyProps {
  devices: Device[];
  isLoading?: boolean;
  /**
   * The empty state, as the design's `data-placeholder`: icon over a title over
   * a description. Wins over `emptyMessage` when both are given.
   */
  emptyState?: NoDataProps;
  /** @deprecated Single-line variant of {@link emptyState} — pass `emptyState` instead. */
  emptyMessage?: string;
  skeletonRows?: number;
  stickyHeaderOffset?: string;
  footerSlot?: ReactNode;
  deviceFilters?: DeviceFilters | null;
  columnFilters?: ColumnFiltersState;
  onColumnFiltersChange?: OnChangeFn<ColumnFiltersState>;
  /** Optional extra column inserted before the open-in-new-tab column (e.g. row actions on the dedicated page). */
  actionsColumn?: ColumnDef<Device>;
  /** Column ids to drop from the base table columns (e.g. ['organization'] when scoped to a single org). */
  hideColumns?: string[];
  /** Column ids whose header filter is dropped while the column stays visible (e.g. ['status'] on the archive page). */
  disableColumnFilters?: string[];
  /** The facet query is still in flight — see `getDeviceTableColumns`. */
  filtersPending?: boolean;
  /** Server-side total (for paginated lists). Falls back to loaded-row count when omitted. */
  totalCount?: number;
  /**
   * Render the column header. Default true.
   *
   * Pass `false` to drop it over a genuinely empty list — column labels above
   * nothing are noise, and the empty message reads better without a row of
   * headings it does not explain. Keep it `true` while loading (the skeleton
   * rows are the content it belongs to) and whenever the emptiness is the RESULT
   * of narrowing: the column funnels live in this header, so removing it would
   * strip the only way to undo the filter that emptied the table.
   */
  showHeader?: boolean;
}

export function DevicesTableBody({
  devices,
  isLoading,
  emptyState,
  emptyMessage = 'No devices found.',
  skeletonRows = 10,
  stickyHeaderOffset,
  footerSlot,
  deviceFilters,
  columnFilters,
  onColumnFiltersChange,
  actionsColumn,
  hideColumns,
  disableColumnFilters,
  filtersPending,
  totalCount,
  showHeader = true,
}: DevicesTableBodyProps) {
  const columns = useMemo<ColumnDef<Device>[]>(() => {
    const hidden = new Set(hideColumns ?? []);
    const unfiltered = new Set(disableColumnFilters ?? []);
    const base = getDeviceTableColumns(deviceFilters ?? null, filtersPending)
      .filter(c => !c.id || !hidden.has(c.id))
      .map(c => (c.id && unfiltered.has(c.id) ? { ...c, meta: { ...c.meta, filter: undefined } } : c));
    return actionsColumn ? [...base, actionsColumn, DEVICE_OPEN_COLUMN] : [...base, DEVICE_OPEN_COLUMN];
  }, [deviceFilters, filtersPending, actionsColumn, hideColumns, disableColumnFilters]);

  const table = useDataTable<Device>({
    data: devices,
    columns,
    getRowId: row => String(row.machineId ?? row.id),
    enableSorting: false,
    state: columnFilters !== undefined ? { columnFilters } : undefined,
    onColumnFiltersChange,
  });

  return (
    <DataTable table={table}>
      {showHeader && (
        <DataTable.Header
          stickyHeader={!!stickyHeaderOffset}
          stickyHeaderOffset={stickyHeaderOffset}
          rightSlot={<DataTable.RowCount itemName="device" totalCount={totalCount} />}
        />
      )}
      <DataTable.Body
        loading={isLoading}
        skeletonRows={skeletonRows}
        emptyState={emptyState}
        emptyMessage={emptyState ? undefined : emptyMessage}
        rowClassName="mb-1"
        rowHref={deviceRowHref}
      />
      {footerSlot}
    </DataTable>
  );
}

function OrganizationCell({ device }: { device: Device }) {
  const fullImageUrl = getFullImageUrl(device.organizationImageUrl, device.organizationImageHash);

  return (
    <div className="flex items-center gap-3">
      <EntityImage src={fullImageUrl} alt={device.organization || 'Customer'} className="size-12 md:size-12" />
      <div className="flex flex-col justify-center flex-1 min-w-0">
        <span className="text-h4 text-ods-text-primary break-words">{device.organization || ''}</span>
      </div>
    </div>
  );
}

export interface DeviceFilterColumn {
  key: string;
  label: string;
  filterable?: boolean;
  filterOptions?: Array<{ id: string; label: string; value: string }>;
}

// Filter column metadata used by the external filter modal (useTagFilterModal).
// Kept separate from the table ColumnDef because DataTable doesn't carry the
// filter metadata that the external mobile filter modal needs.
export function getDeviceFilterColumns(deviceFilters?: DeviceFilters | null): DeviceFilterColumn[] {
  return [
    {
      key: 'device',
      label: 'DEVICE',
    },
    {
      key: 'status',
      label: 'STATUS',
      filterable: true,
      filterOptions: (() => {
        const statuses = deviceFilters?.statuses || [];
        // Show only DEFAULT_VISIBLE_STATUSES (ARCHIVED lives on /devices/archive, DELETED hidden)
        return statuses
          .filter(s => (DEFAULT_VISIBLE_STATUSES as readonly string[]).includes(s.value))
          .map(status => ({
            id: status.value,
            label: getDeviceStatusConfig(status.value).label,
            value: status.value,
          }));
      })(),
    },
    {
      key: 'os',
      label: 'OS',
      filterable: true,
      filterOptions:
        deviceFilters?.osTypes?.map(os => ({
          id: os.value,
          label: os.value,
          value: os.value,
        })) || [],
    },
    {
      key: 'organization',
      label: 'CUSTOMER',
      filterable: true,
      filterOptions: deduplicateFilterOptions(
        deviceFilters?.organizationIds?.map(org => ({
          id: org.value,
          label: org.label,
          value: org.value,
        })) || [],
      ),
    },
  ];
}

/**
 * @param filtersPending The `deviceFilters` query is in flight — keeps the
 * funnels drawn (inert) rather than growing them when it answers. Absent means
 * these are the final options: an empty one then hides its funnel, which is what
 * a list with no facet source of its own wants.
 */
export function getDeviceTableColumns(
  deviceFilters?: DeviceFilters | null,
  filtersPending?: boolean,
): ColumnDef<Device>[] {
  const statusFilterOptions = (() => {
    const statuses = deviceFilters?.statuses || [];
    return statuses
      .filter(s => (DEFAULT_VISIBLE_STATUSES as readonly string[]).includes(s.value))
      .map(s => ({ id: s.value, label: getDeviceStatusConfig(s.value).label, value: s.value }));
  })();

  const osFilterOptions = deviceFilters?.osTypes?.map(os => ({ id: os.value, label: os.value, value: os.value })) ?? [];

  const orgFilterOptions = deduplicateFilterOptions(
    deviceFilters?.organizationIds?.map(org => ({ id: org.value, label: org.label, value: org.value })) ?? [],
  );

  return [
    {
      accessorKey: 'device',
      id: 'device',
      header: 'DEVICE',
      cell: ({ row }: { row: Row<Device> }) => {
        const device = row.original;
        return (
          <div className="box-border content-stretch flex gap-4 h-20 items-center justify-start py-0 relative shrink-0 w-full">
            <div className="flex h-8 w-8 items-center justify-center relative rounded-[6px] shrink-0 border border-ods-border">
              {device.type &&
                getDeviceTypeIcon(device.type.toLowerCase() as DeviceType, {
                  className: 'w-5 h-5 text-ods-text-secondary',
                })}
            </div>
            <div className="flex-1 min-w-0">
              <TruncateText>{getDeviceName(device)}</TruncateText>
            </div>
          </div>
        );
      },
      meta: { width: 'flex-1 md:w-1/4' },
    },
    {
      accessorKey: 'status',
      id: 'status',
      header: 'STATUS',
      cell: ({ row }: { row: Row<Device> }) => {
        const device = row.original;
        const statusConfig = getDeviceStatusConfig(device.status);
        return (
          <div className="flex flex-col items-start gap-1 shrink-0">
            <div className="inline-flex">
              <Tag label={statusConfig.label} variant={statusConfig.variant} />
            </div>
            <span className="text-h6 text-ods-text-secondary hidden md:flex">
              {device.last_seen ? formatDateTime(device.last_seen) : 'Never'}
            </span>
          </div>
        );
      },
      meta: {
        width: 'w-[80px] md:w-1/5',
        // Declared unconditionally, empty options and all. `meta.filter` is what
        // keeps a header cell visible below `lg`, so dropping it until the
        // options query resolves made every header on a tablet disappear on
        // reload — and reserving the funnel from the start keeps the label from
        // shifting when they arrive. The dropdown stays shut while it is empty.
        filter: { options: statusFilterOptions, pending: filtersPending },
      },
    },
    {
      accessorKey: 'os',
      id: 'os',
      header: 'OS',
      cell: ({ row }: { row: Row<Device> }) => (
        <OSTypeBadge osType={row.original.osType} iconSize="w-4 h-4 md:w-6 md:h-6" />
      ),
      meta: {
        width: 'w-[200px] md:w-1/6',
        hideAt: 'md',
        filter: { options: osFilterOptions, pending: filtersPending },
      },
    },
    {
      accessorKey: 'organization',
      id: 'organization',
      header: 'CUSTOMER',
      cell: ({ row }: { row: Row<Device> }) => <OrganizationCell device={row.original} />,
      meta: {
        width: 'w-1/6',
        hideAt: 'lg',
        filter: { options: orgFilterOptions, placement: 'bottom-end', pending: filtersPending },
      },
    },
  ];
}
