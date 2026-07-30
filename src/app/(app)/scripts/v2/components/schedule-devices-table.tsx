'use client';

import {
  type ColumnFiltersState,
  DataTable,
  type OnChangeFn,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useCallback, useMemo, useState } from 'react';
import { DevicesTableBody, getDeviceFilterColumns } from '@/app/(app)/devices/components/devices-table-columns';
import { useTagFilterModal } from '@/app/(app)/devices/hooks/use-tag-filter-modal';
import type { Device, DeviceFilters } from '@/app/(app)/devices/types/device.types';
import { DevicesFilterToolbar } from '@/app/components/shared';

interface ScheduleDevicesTableProps {
  devices: Device[];
  loading?: boolean;
  /**
   * Server-side size of the assignment. The table holds only the pages pulled
   * so far, so this is what the row count reports — but only while nothing is
   * narrowed, since narrowing happens client-side and the server total would
   * then overstate what is on screen.
   */
  totalCount?: number;
  infiniteScroll?: {
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    onLoadMore: () => void;
    skeletonRows?: number;
  };
}

/**
 * The schedule's Assigned Devices tab.
 *
 * Renders the SAME table as the Devices page — shared `DevicesTableBody`,
 * shared columns, shared search/tags toolbar — over the machines assigned to
 * this schedule. Only the data source differs: that page queries `devices` with
 * URL-driven server filters, this tab reads the schedule's `assignedDevices`
 * connection.
 *
 * Consequences of that difference, both deliberate:
 *
 * - **Filter options are derived from the loaded rows**, not from a
 *   `deviceFilters` query. An assignment is a small, closed set, so the options
 *   actually present are the only sensible ones to offer.
 * - **Search, column funnels and tag chips run client-side** over the pages
 *   pulled so far — a page not yet fetched is not searched. `assignedDevices`
 *   accepts `search`/`filter` server-side, so moving them there is the real fix
 *   once assignments get long enough to outrun the first pages.
 */
export function ScheduleDevicesTable({ devices, loading, totalCount, infiniteScroll }: ScheduleDevicesTableProps) {
  const [search, setSearch] = useState('');
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // The `DeviceFilters` shape the shared header funnels and the filter modal
  // expect, counted off the loaded assignment instead of a backend call.
  const deviceFilters = useMemo<DeviceFilters>(() => {
    const statusCounts = new Map<string, number>();
    const osCounts = new Map<string, number>();
    const orgCounts = new Map<string, { label: string; count: number }>();
    const tagSeen = new Map<string, Map<string, number>>();

    for (const d of devices) {
      if (d.status) statusCounts.set(d.status, (statusCounts.get(d.status) ?? 0) + 1);
      if (d.osType) osCounts.set(d.osType, (osCounts.get(d.osType) ?? 0) + 1);
      if (d.organization) {
        const existing = orgCounts.get(d.organization);
        orgCounts.set(d.organization, { label: d.organization, count: (existing?.count ?? 0) + 1 });
      }
      for (const tag of d.tags ?? []) {
        if (!tagSeen.has(tag.key)) tagSeen.set(tag.key, new Map());
        const values = tagSeen.get(tag.key)!;
        for (const v of tag.values) values.set(v, (values.get(v) ?? 0) + 1);
      }
    }

    const tagKeys: Array<{ key: string; value: string; count: number }> = [];
    for (const [key, values] of tagSeen) {
      for (const [value, count] of values) {
        tagKeys.push({ key, value, count });
      }
    }

    return {
      statuses: Array.from(statusCounts, ([value, count]) => ({ value, count })),
      deviceTypes: [],
      osTypes: Array.from(osCounts, ([value, count]) => ({ value, count })),
      organizationIds: Array.from(orgCounts, ([value, { label, count }]) => ({ value, label, count })),
      tagKeys,
      filteredCount: devices.length,
    };
  }, [devices]);

  const filterColumns = useMemo(() => getDeviceFilterColumns(deviceFilters), [deviceFilters]);

  // The modal hands back one flat params object; split it into our two states.
  const handleSetParams = useCallback((params: Record<string, unknown>) => {
    const pick = (key: string) => (params[key] as string[] | undefined) ?? [];
    setColumnFilters([
      ...(pick('statuses').length ? [{ id: 'status', value: pick('statuses') }] : []),
      ...(pick('osTypes').length ? [{ id: 'os', value: pick('osTypes') }] : []),
      ...(pick('organizationIds').length ? [{ id: 'organization', value: pick('organizationIds') }] : []),
    ]);
    setSelectedTags(pick('tags'));
  }, []);

  const {
    isOpen: filterModalOpen,
    open: openFilterModal,
    close: closeFilterModal,
    isMdUp,
    filterGroups,
    tagFilterKeys,
    handleFilterChange: handleModalFilterChange,
    handleTagsChange: handleModalTagsChange,
  } = useTagFilterModal({
    tags: selectedTags,
    deviceFilters,
    columns: filterColumns,
    setParams: handleSetParams,
  });

  // Chips are "key:value" (e.g. "env:prod"); a bare word stays visible but
  // filters nothing, matching the Devices page.
  const selectedTagValues = useMemo(
    () =>
      selectedTags.flatMap(t => {
        const i = t.indexOf(':');
        return i > 0 ? [t.substring(i + 1)] : [];
      }),
    [selectedTags],
  );

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle && columnFilters.length === 0 && selectedTagValues.length === 0) return devices;

    return devices.filter(d => {
      if (needle) {
        const name = (d.displayName || d.hostname || '').toLowerCase();
        const org = (d.organization || '').toLowerCase();
        if (!name.includes(needle) && !org.includes(needle)) return false;
      }
      for (const f of columnFilters) {
        const values = f.value as string[];
        if (!values || values.length === 0) continue;
        const cell = f.id === 'status' ? d.status : f.id === 'os' ? d.osType : d.organization;
        if (cell === undefined || !values.includes(cell)) return false;
      }
      if (selectedTagValues.length > 0) {
        const matches = (d.tags ?? []).some(tag => tag.values.some(v => selectedTagValues.includes(v)));
        if (!matches) return false;
      }
      return true;
    });
  }, [devices, search, columnFilters, selectedTagValues]);

  const onColumnFiltersChange = useCallback<OnChangeFn<ColumnFiltersState>>(updater => {
    setColumnFilters(prev => (typeof updater === 'function' ? updater(prev) : updater));
  }, []);

  const tagOptions = useMemo(() => selectedTags.map(t => ({ label: t, value: t })), [selectedTags]);

  // The mobile modal reads the current selection back in column-keyed form.
  const tableFilters = useMemo(
    () => ({
      status: (columnFilters.find(f => f.id === 'status')?.value as string[]) ?? [],
      os: (columnFilters.find(f => f.id === 'os')?.value as string[]) ?? [],
      organization: (columnFilters.find(f => f.id === 'organization')?.value as string[]) ?? [],
    }),
    [columnFilters],
  );

  const handleTagRemove = useCallback((value: string) => {
    setSelectedTags(prev => prev.filter(t => t !== value));
  }, []);

  const handleClearAll = useCallback(() => {
    setSearch('');
    setSelectedTags([]);
  }, []);

  const handleTagSubmit = useCallback((value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setSelectedTags(prev => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
    setSearch('');
  }, []);

  const hasActiveFilters = search.trim().length > 0 || columnFilters.length > 0 || selectedTags.length > 0;

  return (
    <div className="flex flex-col gap-[var(--spacing-system-l)]">
      <DevicesFilterToolbar
        sticky={false}
        searchValue={search}
        onSearchChange={setSearch}
        tags={tagOptions}
        onTagRemove={handleTagRemove}
        onClearAll={handleClearAll}
        onSubmit={handleTagSubmit}
        onOpenFilterModal={openFilterModal}
        isFilterModalOpen={filterModalOpen}
        onCloseFilterModal={closeFilterModal}
        filterGroups={filterGroups}
        onFilterChange={handleModalFilterChange}
        currentFilters={isMdUp === false ? tableFilters : undefined}
        tagFilterKeys={tagFilterKeys}
        selectedTags={selectedTags}
        onTagsChange={handleModalTagsChange}
      />

      <DevicesTableBody
        devices={rows}
        isLoading={loading}
        // "No devices assigned to this schedule yet" is the whole content of an
        // unassigned tab; a row of column labels above it explains nothing. It
        // stays while loading — the skeleton rows are what it labels — and
        // whenever a search, tag chip or column funnel is what emptied the list,
        // since the funnels live in that header.
        showHeader={loading || rows.length > 0 || hasActiveFilters}
        emptyMessage={
          hasActiveFilters
            ? 'No devices found. Try adjusting your search or filters.'
            : 'No devices assigned to this schedule yet.'
        }
        skeletonRows={8}
        deviceFilters={deviceFilters}
        columnFilters={columnFilters}
        onColumnFiltersChange={onColumnFiltersChange}
        totalCount={hasActiveFilters ? undefined : totalCount}
        footerSlot={
          infiniteScroll && (
            <DataTable.InfiniteFooter
              hasNextPage={infiniteScroll.hasNextPage}
              isFetchingNextPage={infiniteScroll.isFetchingNextPage}
              onLoadMore={infiniteScroll.onLoadMore}
              skeletonRows={infiniteScroll.skeletonRows}
            />
          )
        }
      />
    </div>
  );
}
