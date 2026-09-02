'use client';

import { type DeviceType, getDeviceTypeIcon } from '@flamingo-stack/openframe-frontend-core';
import { OSTypeBadge } from '@flamingo-stack/openframe-frontend-core/components/features';
import {
  ArrowRightUpIcon,
  BracketCurlyEllipsisVrIcon,
  Filter02Icon,
  MonitorIcon,
  SearchIcon,
  XmarkCircleIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Button,
  type ColumnDef,
  DataTable,
  EntityImage,
  FilterModal,
  Input,
  type Row,
  Tag,
  TruncateText,
  useDataTable,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useMdUp } from '@flamingo-stack/openframe-frontend-core/hooks';
import { formatRelativeTime } from '@flamingo-stack/openframe-frontend-core/utils';
import { useCallback, useMemo, useState } from 'react';
import { getFullImageUrl } from '@/lib/image-url';
import { openInNewTab } from '@/lib/open-in-new-tab';
import { routes } from '@/lib/routes';
import { multiSelectFilterFn } from '@/lib/table-filters';
import { getDeviceStatusConfig } from '../../../devices/utils/device-status';
import { QuickQueryPanel } from '../../policy/components/quick-query-panel';
import { useQueryDevicesTable } from '../hooks/use-query-devices-table';
import type { QueryDeviceRow } from '../types/query-device-row';

interface QueryDevicesTableProps {
  queryId: number;
  /** Query osquery SQL — copied into the per-device Quick Query draft. */
  query?: string;
}

export function QueryDevicesTable({ queryId, query }: QueryDevicesTableProps) {
  const { rows, isLoading } = useQueryDevicesTable(queryId);
  const isMdUp = useMdUp();
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
        row.displayName.toLowerCase().includes(term) ||
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
        id: 'device',
        accessorKey: 'displayName',
        header: 'DEVICE',
        cell: ({ row }: { row: Row<QueryDeviceRow> }) => {
          const r = row.original;
          return (
            <div className="relative box-border flex h-20 w-full shrink-0 content-stretch items-center justify-start gap-4 py-0">
              <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] border border-ods-border">
                {r.deviceType &&
                  getDeviceTypeIcon(r.deviceType.toLowerCase() as DeviceType, {
                    className: 'w-5 h-5 text-ods-text-secondary',
                  })}
              </div>
              <div className="flex min-w-0 flex-1 flex-col justify-center">
                <TruncateText>{r.displayName || r.hostname}</TruncateText>
                {r.lastSeen && (
                  <TruncateText variant="h6" tone="secondary">
                    {`Last online: ${formatRelativeTime(r.lastSeen)}`}
                  </TruncateText>
                )}
              </div>
            </div>
          );
        },
        meta: { width: 'flex-1 md:w-1/3' },
      },
      {
        id: 'organization',
        accessorKey: 'organization',
        header: 'CUSTOMER',
        cell: ({ row }: { row: Row<QueryDeviceRow> }) => {
          const r = row.original;
          const fullImageUrl = getFullImageUrl(r.organizationImageUrl, r.organizationImageHash);
          return (
            <div className="flex items-center gap-3">
              <EntityImage src={fullImageUrl} alt={r.organization || 'Customer'} className="size-12 md:size-12" />
              <div className="flex min-w-0 flex-1 flex-col justify-center">
                <span className="break-words text-ods-text-primary text-h4">{r.organization || ''}</span>
              </div>
            </div>
          );
        },
        filterFn: multiSelectFilterFn,
        meta: { width: 'w-1/6', hideAt: 'lg' as const, filter: { options: customerOptions } },
      },
      {
        id: 'os',
        accessorKey: 'osType',
        header: 'OS',
        cell: ({ row }: { row: Row<QueryDeviceRow> }) => (
          <div className="flex shrink-0 items-start gap-2">
            <OSTypeBadge osType={row.original.osType} />
          </div>
        ),
        filterFn: multiSelectFilterFn,
        meta: { width: 'w-[120px] md:w-1/6', hideAt: 'md' as const, filter: { options: osOptions } },
      },
      {
        id: 'status',
        accessorKey: 'status',
        header: 'STATUS',
        cell: ({ row }: { row: Row<QueryDeviceRow> }) => {
          const config = getDeviceStatusConfig(row.original.status);
          return <Tag label={config.label} variant={config.variant} />;
        },
        filterFn: multiSelectFilterFn,
        meta: { width: 'w-[140px]', filter: { options: statusOptions } },
      },
      {
        id: 'open',
        cell: ({ row }: { row: Row<QueryDeviceRow> }) =>
          row.original.machineId ? (
            <div data-no-row-click className="pointer-events-auto flex items-center justify-end">
              <Button
                onClick={openInNewTab(routes.devices.details(row.original.machineId))}
                variant="outline"
                size="icon"
                leftIcon={<ArrowRightUpIcon className="h-5 w-5" />}
                aria-label="Open in new tab"
                className="bg-ods-card"
              />
            </div>
          ) : null,
        enableSorting: false,
        meta: { width: 'w-12 shrink-0 flex-none', hideAt: 'md', align: 'right' },
      },
      {
        id: 'quick-query',
        cell: ({ row }: { row: Row<QueryDeviceRow> }) => {
          const isOpen = quickQueryIds.has(String(row.original.id));
          return (
            <div data-no-row-click className="pointer-events-auto flex items-center justify-end">
              <Button
                onClick={() => toggleQuickQuery(String(row.original.id))}
                variant="outline"
                disabled={!isOpen && !hasQuery}
                leftIcon={
                  isOpen ? <XmarkCircleIcon className="h-5 w-5" /> : <BracketCurlyEllipsisVrIcon className="h-5 w-5" />
                }
                aria-label={isOpen ? 'Close quick query' : 'Open quick query'}
                aria-expanded={isOpen}
                className="w-full bg-ods-card"
              >
                {/* Icon-only on mobile, per design. */}
                <span className="hidden md:inline">{isOpen ? 'Close' : 'Quick Query'}</span>
              </Button>
            </div>
          );
        },
        enableSorting: false,
        // Fixed column width (matching the header's empty cell) so the flex
        // columns before it stretch identically in the header and the rows;
        // the w-full button inside also keeps Quick Query / Close equal width.
        meta: { width: 'w-12 md:w-[160px] shrink-0 flex-none', align: 'right' },
      },
    ],
    [statusOptions, osOptions, customerOptions, quickQueryIds, toggleQuickQuery, hasQuery],
  );

  const table = useDataTable<QueryDeviceRow>({
    data: filteredRows,
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
      return <QuickQueryPanel fleetHostId={row.fleetHostId} initialQuery={query ?? ''} />;
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
            placeholder="Search for Devices"
            value={search}
            onChange={e => setSearch(e.target.value)}
            startAdornment={<SearchIcon className="h-4 w-4 md:h-6 md:w-6" />}
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
          skeletonRows={5}
          emptyState={emptyState}
          rowHref={rowHref}
          renderSubRow={renderSubRow}
        />
      </DataTable>

      <FilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        filterGroups={[]}
        onFilterChange={() => {}}
        tagFilterKeys={tagFilterKeys}
        selectedTags={selectedTags}
        onTagsChange={setSelectedTags}
        className="max-w-[600px]"
      />
    </div>
  );
}
