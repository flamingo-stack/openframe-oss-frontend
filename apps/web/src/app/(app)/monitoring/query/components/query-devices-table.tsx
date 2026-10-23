'use client';

import { TextLineSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import {
  DeviceTypeTile,
  formatLastOnline,
  getDeviceStatusConfig,
  OSTypeBadge,
} from '@flamingo-stack/openframe-frontend-core/components/features';
import { Filter02Icon, MonitorIcon, SearchIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Button,
  type ColumnDef,
  DataTable,
  FilterModal,
  Input,
  type Row,
  Tag,
  TruncateText,
  useDataTable,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useContentMdUp } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useCallback, useMemo, useState } from 'react';
import { NO_ITEMS, noop } from '@/app/components/shared';
import { loadingPlaceholderRows } from '@/app/components/shared/live-table';
import { liveColumnMeta } from '@/app/components/shared/table-column-layout';
import { routes } from '@/lib/routes';
import { multiSelectFilterFn } from '@/lib/table-filters';
import { MONITORING_DEVICES_SKELETON_ROWS, QUERY_DEVICE_COLUMNS } from '../../components/monitoring-table-columns';
import { DeviceCustomerCell, DeviceOpenCell, QuickQueryToggle } from '../../policy/components/policy-devices-table';
import { QuickQueryPanel } from '../../policy/components/quick-query-panel';
import { useQueryDevicesTable } from '../hooks/use-query-devices-table';
import type { QueryDeviceRow } from '../types/query-device-row';

interface QueryDevicesTableProps {
  queryId: number;
  /** Query osquery SQL — copied into the per-device Quick Query draft. */
  query?: string;
}

/**
 * The query's devices. In a loading scope (the query itself still loading) it reads nothing and draws the table's
 * own loading rows; otherwise it reads the devices and draws them.
 */
export function QueryDevicesTable(props: QueryDevicesTableProps) {
  if (useLoadingScope()) return <QueryDevicesTableView rows={NO_ITEMS} isLoading query={props.query} />;
  return <QueryDevicesTableContent {...props} />;
}

function QueryDevicesTableContent({ queryId, query }: QueryDevicesTableProps) {
  const { rows, isLoading } = useQueryDevicesTable(queryId);
  return <QueryDevicesTableView rows={rows} isLoading={isLoading} query={query} />;
}

interface QueryDevicesTableViewProps {
  rows: QueryDeviceRow[];
  isLoading: boolean;
  query?: string;
}

function QueryDevicesTableView({ rows, isLoading, query }: QueryDevicesTableViewProps) {
  const isMdUp = useContentMdUp();
  const [search, setSearch] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  const [quickQueryIds, setQuickQueryIds] = useState<Set<string>>(new Set());
  const hasQuery = Boolean(query?.trim());

  const toggleQuickQuery = useCallback((rowId: string) => {
    setQuickQueryIds(prev => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  }, []);

  // Device tags grouped by key → values, for the "Device Tags" FilterModal
  // (same shape the /devices tag filter modal consumes).
  const tagFilterKeys = useMemo(() => {
    const grouped = new Map<string, Map<string, { id: string; label: string }>>();
    for (const row of rows) {
      for (const tag of row.tags) {
        const values = grouped.get(tag.key) ?? new Map<string, { id: string; label: string }>();
        grouped.set(tag.key, values);
        if (!values.has(tag.value)) values.set(tag.value, { id: tag.value, label: tag.value });
      }
    }
    return Array.from(grouped, ([key, values]) => ({
      key,
      label: key,
      values: Array.from(values.values()).sort((a, b) => a.label.localeCompare(b.label)),
    })).sort((a, b) => a.label.localeCompare(b.label));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter(row => {
      const matchesSearch =
        term.length === 0 ||
        row.name.toLowerCase().includes(term) ||
        row.hostname.toLowerCase().includes(term) ||
        (row.organization?.toLowerCase().includes(term) ?? false);
      const matchesTags =
        selectedTags.length === 0 || row.tags.some(tag => selectedTags.includes(`${tag.key}:${tag.value}`));
      return matchesSearch && matchesTags;
    });
  }, [rows, search, selectedTags]);

  // Column-header filter options, built from the full assigned-device set so the
  // choices stay stable regardless of the active search/tag/column filters.
  const statusOptions = useMemo(() => {
    const seen = new Map<string, { id: string; label: string; value: string }>();
    for (const row of rows) {
      if (!seen.has(row.status)) {
        seen.set(row.status, { id: row.status, label: getDeviceStatusConfig(row.status).label, value: row.status });
      }
    }
    return Array.from(seen.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [rows]);

  const osOptions = useMemo(() => {
    const seen = new Map<string, { id: string; label: string; value: string }>();
    for (const row of rows) {
      if (row.osType && !seen.has(row.osType)) {
        seen.set(row.osType, { id: row.osType, label: row.osType, value: row.osType });
      }
    }
    return Array.from(seen.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [rows]);

  const customerOptions = useMemo(() => {
    const seen = new Map<string, { id: string; label: string; value: string }>();
    for (const row of rows) {
      if (row.organization && !seen.has(row.organization)) {
        seen.set(row.organization, { id: row.organization, label: row.organization, value: row.organization });
      }
    }
    return Array.from(seen.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [rows]);

  const columns = useMemo<ColumnDef<QueryDeviceRow>[]>(
    () => [
      {
        id: QUERY_DEVICE_COLUMNS.device.id,
        accessorKey: 'name',
        header: QUERY_DEVICE_COLUMNS.device.header,
        cell: ({ row }: { row: Row<QueryDeviceRow> }) => {
          const r = row.original;
          return (
            <div className="relative box-border flex h-20 w-full shrink-0 content-stretch items-center justify-start gap-4 py-0">
              <DeviceTypeTile type={r.deviceType} />
              <div className="flex min-w-0 flex-1 flex-col justify-center">
                <TruncateText>{r.name}</TruncateText>
                <DeviceLastOnline lastSeen={r.lastSeen} />
              </div>
            </div>
          );
        },
        meta: liveColumnMeta(QUERY_DEVICE_COLUMNS.device),
      },
      {
        id: QUERY_DEVICE_COLUMNS.organization.id,
        accessorKey: 'organization',
        header: QUERY_DEVICE_COLUMNS.organization.header,
        cell: ({ row }: { row: Row<QueryDeviceRow> }) => (
          <DeviceCustomerCell
            organization={row.original.organization}
            imageUrl={row.original.organizationImageUrl}
            imageHash={row.original.organizationImageHash}
          />
        ),
        filterFn: multiSelectFilterFn,
        meta: liveColumnMeta(QUERY_DEVICE_COLUMNS.organization, { filter: { options: customerOptions } }),
      },
      {
        id: QUERY_DEVICE_COLUMNS.os.id,
        accessorKey: 'osType',
        header: QUERY_DEVICE_COLUMNS.os.header,
        cell: ({ row }: { row: Row<QueryDeviceRow> }) => (
          <div className="flex shrink-0 items-start gap-2">
            <OSTypeBadge osType={row.original.osType} />
          </div>
        ),
        filterFn: multiSelectFilterFn,
        meta: liveColumnMeta(QUERY_DEVICE_COLUMNS.os, { filter: { options: osOptions } }),
      },
      {
        id: QUERY_DEVICE_COLUMNS.status.id,
        accessorKey: 'status',
        header: QUERY_DEVICE_COLUMNS.status.header,
        cell: ({ row }: { row: Row<QueryDeviceRow> }) => <DeviceStatusCell status={row.original.status} />,
        filterFn: multiSelectFilterFn,
        meta: liveColumnMeta(QUERY_DEVICE_COLUMNS.status, { filter: { options: statusOptions } }),
      },
      {
        id: QUERY_DEVICE_COLUMNS.open.id,
        cell: ({ row }: { row: Row<QueryDeviceRow> }) => <DeviceOpenCell machineId={row.original.machineId} />,
        enableSorting: false,
        meta: liveColumnMeta(QUERY_DEVICE_COLUMNS.open),
      },
      {
        id: QUERY_DEVICE_COLUMNS.quickQuery.id,
        cell: ({ row }: { row: Row<QueryDeviceRow> }) => (
          <QuickQueryToggle
            isOpen={quickQueryIds.has(String(row.original.id))}
            hasQuery={hasQuery}
            onToggle={() => toggleQuickQuery(String(row.original.id))}
          />
        ),
        enableSorting: false,
        meta: liveColumnMeta(QUERY_DEVICE_COLUMNS.quickQuery),
      },
    ],
    [statusOptions, osOptions, customerOptions, quickQueryIds, toggleQuickQuery, hasQuery],
  );

  // While loading the table holds one typical list of placeholder rows, drawn with the real cells (`loadingCells`):
  // every part of a row draws its own loading form, so a loading row is the loaded row's own layout.
  const loadingRows = useMemo(
    () => (isLoading ? loadingPlaceholderRows<QueryDeviceRow>(MONITORING_DEVICES_SKELETON_ROWS) : null),
    [isLoading],
  );

  const table = useDataTable<QueryDeviceRow>({
    data: loadingRows ?? filteredRows,
    columns,
    getRowId: (row: QueryDeviceRow) => String(row.id),
    enableSorting: false,
    clientSideFiltering: true,
  });

  const rowHref = useCallback(
    (row: QueryDeviceRow) => (row.machineId ? routes.devices.details(row.machineId) : undefined),
    [],
  );

  // The panel mounts on open and unmounts on close, so each open copies the
  // current query into a fresh draft and drops any previous run state.
  const renderSubRow = useCallback(
    (row: QueryDeviceRow) => {
      if (!quickQueryIds.has(String(row.id))) return null;
      return <QuickQueryPanel fleetHostId={row.fleetHostId} deviceName={row.name} initialQuery={query ?? ''} />;
    },
    [quickQueryIds, query],
  );

  const tagsActive = selectedTags.length > 0;
  const hasActiveFilters = search.trim().length > 0 || tagsActive || table.getState().columnFilters.length > 0;
  const emptyState = hasActiveFilters
    ? { icon: <MonitorIcon />, title: 'No devices match the current filters' }
    : {
        icon: <MonitorIcon />,
        title: 'No devices assigned',
        description: 'Assign devices to this query to start tracking them',
      };
  // Per the design, the empty state replaces the whole table - headers hidden.
  const showHeader = isLoading || filteredRows.length > 0;

  return (
    <div className="flex flex-col gap-[var(--spacing-system-m)]">
      <div className="flex items-start gap-[var(--spacing-system-m)]">
        <div className="min-w-0 flex-1">
          <Input
            userValue
            placeholder="Search for Devices"
            value={search}
            onChange={e => setSearch(e.target.value)}
            startAdornment={<SearchIcon className="h-4 w-4 content-md:h-6 content-md:w-6" />}
          />
        </div>
        {isMdUp ? (
          <Button
            variant="outline"
            onClick={() => setIsFilterModalOpen(true)}
            leftIcon={<Filter02Icon className="text-ods-text-secondary" />}
            className="shrink-0"
          >
            Device Tags
          </Button>
        ) : (
          <Button
            variant="outline"
            size="icon"
            aria-label="Device Tags"
            onClick={() => setIsFilterModalOpen(true)}
            // Primary below md: with the label gone the funnel is the button.
            leftIcon={<Filter02Icon className="text-ods-text-primary" />}
            className="shrink-0"
          />
        )}
      </div>

      <DataTable table={table}>
        {showHeader && <DataTable.Header rightSlot={<DataTable.RowCount />} />}
        <DataTable.Body
          loading={isLoading}
          loadingCells={isLoading}
          skeletonRows={MONITORING_DEVICES_SKELETON_ROWS}
          emptyState={emptyState}
          rowHref={rowHref}
          renderSubRow={renderSubRow}
        />
      </DataTable>

      <FilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        filterGroups={[]}
        onFilterChange={noop}
        tagFilterKeys={tagFilterKeys}
        selectedTags={selectedTags}
        onTagsChange={setSelectedTags}
        className="max-w-[600px]"
      />
    </div>
  );
}

/** When the device was last online, under its name; a bar on its line while the row is read. */
function DeviceLastOnline({ lastSeen }: { lastSeen: QueryDeviceRow['lastSeen'] | undefined }) {
  if (useLoadingScope() && !lastSeen) return <TextLineSkeleton type="h6" className="w-1/2" />;
  return (
    <TruncateText variant="h6" tone="secondary">
      {formatLastOnline(lastSeen)}
    </TruncateText>
  );
}

/** The device's own state as its tag; the tag's own loading form while the row is read. */
function DeviceStatusCell({ status }: { status: string | undefined }) {
  const loading = useLoadingScope() && !status;
  // A loading placeholder row has no status: nothing to look up, the tag draws its loading form.
  const config = status === undefined ? null : getDeviceStatusConfig(status);
  return <Tag label={config?.label} variant={config?.variant} loading={loading || !config} />;
}
