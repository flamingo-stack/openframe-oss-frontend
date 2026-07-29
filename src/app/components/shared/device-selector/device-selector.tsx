'use client';

import { OSTypeBadge } from '@flamingo-stack/openframe-frontend-core/components/features';
import {
  CheckCircleIcon,
  MonitorIcon,
  PlusCircleIcon,
  TrashIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Button,
  type ColumnDef,
  type ColumnFiltersState,
  DataTable,
  EntityImage,
  type OnChangeFn,
  RadioGroupBlock,
  type RadioGroupBlockOption,
  type Row,
  type TabItem,
  TabNavigation,
  Tag,
  useDataTable,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { formatRelativeTime } from '@flamingo-stack/openframe-frontend-core/utils';
import { useCallback, useMemo, useRef, useState } from 'react';
import { getDeviceFilterColumns } from '@/app/(app)/devices/components/devices-table-columns';
import { DEFAULT_VISIBLE_STATUSES, DEVICE_STATUS } from '@/app/(app)/devices/constants/device-statuses';
import { useTagFilterModal } from '@/app/(app)/devices/hooks/use-tag-filter-modal';
import type { Device, DeviceFilters } from '@/app/(app)/devices/types/device.types';
import { getDeviceStatusConfig } from '@/app/(app)/devices/utils/device-status';
import { DevicesFilterToolbar } from '@/app/components/shared';
import { renderDeviceTypeIcon } from '@/app/components/shared/device-type-icon';
import { deduplicateFilterOptions } from '@/lib/filter-utils';
import { getFullImageUrl } from '@/lib/image-url';
import { DeviceSelectionModeRadio } from './device-selection-mode-radio';
import type { DeviceSelectorProps, SubTab } from './device-selector.types';
import { useDeviceSelector } from './use-device-selector';

const EMPTY_SET: ReadonlySet<string> = new Set();
const NOOP = () => {};
const DEFAULT_GET_DEVICE_KEY = (d: Device): string | undefined => d.machineId || d.id;

/**
 * Selection-oriented devices list. Sits next to `DevicesPanel` (the listing
 * page), but the data model is different and intentional:
 *
 * - **Data is owned by the parent.** The consumer passes a pre-fetched
 *   `devices: Device[]` and (optionally) an `infiniteScroll` config. This is
 *   because consumers fetch from different backends — GraphQL `devices` query
 *   (TestScriptModal, ScheduleAssignDevicesView), Tactical RMM REST
 *   (RunScriptView), Fleet MDM (monitoring queries/policies). A single
 *   internal `useDevices` wouldn't fit all of them.
 *
 * - **Filtering is client-side.** Column filter funnels (status/customer) and
 *   tag chips operate on the `devices` array via `Array.filter`. Filter
 *   options shown in the dropdowns are derived from the same array (no extra
 *   network call). Trade-off: if the parent passes a partial page, the
 *   filters see only that page — not the full dataset on the server.
 *
 * - **Pagination is parent-driven via `infiniteScroll`.** The component just
 *   renders `DataTable.InfiniteFooter` and calls `onLoadMore`. The consumer
 *   owns the fetching strategy. In practice all current consumers fetch the
 *   full list (≤100 devices) and don't pass `infiniteScroll` at all.
 *
 * For a server-driven listing with URL state, GraphQL pagination and filter
 * counts coming from the backend, use `DevicesPanel` instead.
 *
 * Two opt-in modes change the picture above:
 *
 * - **`server`** hands search, filtering, paging and the bulk actions to the
 *   parent's backend — see {@link DeviceSelectorServer}.
 * - **`selectionMode` + `criteriaContent`** swap the picker for the rule editor
 *   of "Select Devices by Criteria": `criteriaContent` replaces the card
 *   entirely, the search toolbar and row actions go away, and the table becomes
 *   a live preview of what the rule matches.
 */
export function DeviceSelector({
  devices,
  loading,
  selectedIds: selectedIdsProp,
  onSelectionChange: onSelectionChangeProp,
  getDeviceKey: getDeviceKeyProp,
  infiniteScroll,
  disabled: disabledProp = false,
  showSelectionModeRadio: showSelectionModeRadioProp = true,
  headerContent,
  addAllBehavior = 'merge',
  singleSelect: singleSelectProp = false,
  isDeviceDisabled,
  hideColumns,
  totalCount,
  readOnly = false,
  server,
  selectionMode,
  onSelectionModeChange,
  criteriaContent,
}: DeviceSelectorProps) {
  // In readOnly mode, force-disable interactions and hide the selection UI.
  const selectedIds = (selectedIdsProp ?? EMPTY_SET) as Set<string>;
  const onSelectionChange = onSelectionChangeProp ?? NOOP;
  const getDeviceKey = getDeviceKeyProp ?? DEFAULT_GET_DEVICE_KEY;
  const disabled = readOnly || disabledProp;
  const showSelectionModeRadio = readOnly ? false : showSelectionModeRadioProp;
  const singleSelect = readOnly ? true : singleSelectProp;
  // Criteria mode replaces the whole picker — card, tabs and search row — with
  // the rule editor over a read-only preview of what that rule resolves to.
  const isCriteria = selectionMode === 'criteria';
  // Called unconditionally (hooks rule); in server mode its results are simply
  // not the ones used — the parent's query already answered those questions.
  const client = useDeviceSelector({ devices, selectedIds, getDeviceKey });

  const searchTerm = server ? server.search : client.searchTerm;
  const setSearchTerm = server ? server.onSearchChange : client.setSearchTerm;
  const activeSubTab = server ? server.activeTab : client.activeSubTab;
  const handleTabChange = useMemo(
    () => (server ? (tabId: string) => server.onTabChange(tabId as SubTab) : client.handleTabChange),
    [server, client.handleTabChange],
  );

  // Read latest selectedIds via ref so toggleDevice can stay reference-stable.
  // The DataTable rows are React.memo'd; rows that don't re-render keep an old
  // toggleDevice closure, and a stale closure that captured an outdated
  // selectedIds would corrupt the set on the next click.
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;

  const [clientColumnFilters, setClientColumnFilters] = useState<ColumnFiltersState>([]);
  const [clientTags, setClientTags] = useState<string[]>([]);

  const columnFilters = server ? server.narrowing.columnFilters : clientColumnFilters;
  const selectedTags = server ? server.narrowing.tags : clientTags;

  const setColumnFilters = useCallback(
    (next: ColumnFiltersState) => {
      if (server) server.onNarrowingChange({ columnFilters: next, tags: server.narrowing.tags });
      else setClientColumnFilters(next);
    },
    [server],
  );

  // TanStack hands either a value or an updater fn; resolve it against what is
  // on screen before it reaches the (possibly lifted) setter above.
  const handleTableColumnFiltersChange = useCallback<OnChangeFn<ColumnFiltersState>>(
    updaterOrValue => {
      setColumnFilters(typeof updaterOrValue === 'function' ? updaterOrValue(columnFilters) : updaterOrValue);
    },
    [columnFilters, setColumnFilters],
  );

  const setSelectedTags = useCallback(
    (next: string[]) => {
      if (server) server.onNarrowingChange({ columnFilters: server.narrowing.columnFilters, tags: next });
      else setClientTags(next);
    },
    [server],
  );

  const clientToggleDevice = useCallback(
    (device: Device) => {
      if (disabled) return;
      if (isDeviceDisabled?.(device)) return;
      const key = getDeviceKey(device);
      if (key === undefined) return;

      const current = selectedIdsRef.current;
      if (singleSelect) {
        onSelectionChange(current.has(key) ? new Set() : new Set([key]));
        return;
      }

      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      onSelectionChange(next);
    },
    [disabled, isDeviceDisabled, getDeviceKey, onSelectionChange, singleSelect],
  );

  // Server mode has no selection set to flip — the row action states what to DO
  // (add here, remove there), and the tab decides which.
  const toggleDevice = useCallback(
    (device: Device) => {
      if (!server) return clientToggleDevice(device);
      if (disabled) return;
      if (isDeviceDisabled?.(device)) return;
      if (server.activeTab === 'selected') server.onRemove(device);
      else server.onAdd(device);
    },
    [server, clientToggleDevice, disabled, isDeviceDisabled],
  );

  const addAllDevices = useCallback(() => {
    if (disabled) return;
    if (server) {
      server.onAddAll();
      return;
    }
    const base = addAllBehavior === 'replace' ? new Set<string>() : new Set(selectedIds);
    for (const d of client.filteredDevices) {
      if (isDeviceDisabled?.(d)) continue;
      const key = getDeviceKey(d);
      if (key !== undefined) {
        base.add(key);
      }
    }
    onSelectionChange(base);
  }, [
    disabled,
    server,
    isDeviceDisabled,
    addAllBehavior,
    selectedIds,
    client.filteredDevices,
    getDeviceKey,
    onSelectionChange,
  ]);

  const removeAllSelected = useCallback(() => {
    if (disabled) return;
    if (server) {
      server.onRemoveAll();
      return;
    }
    onSelectionChange(new Set());
  }, [disabled, server, onSelectionChange]);

  // Filter options are derived client-side from the `devices` prop. We don't
  // hit the backend here — DeviceSelector is given a pre-fetched list, so the
  // only sensible options are the ones actually present.
  const statusFilterOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const d of devices) {
      if (d.status && (DEFAULT_VISIBLE_STATUSES as readonly string[]).includes(d.status)) seen.add(d.status);
    }
    return Array.from(seen)
      .map(s => ({ id: s, label: getDeviceStatusConfig(s).label, value: s }))
      .sort((a, b) => {
        if (a.value === DEVICE_STATUS.ARCHIVED) return 1;
        if (b.value === DEVICE_STATUS.ARCHIVED) return -1;
        return 0;
      });
  }, [devices]);

  const orgFilterOptions = useMemo(() => {
    const opts: Array<{ id: string; label: string; value: string }> = [];
    for (const d of devices) {
      if (d.organization) opts.push({ id: d.organization, label: d.organization, value: d.organization });
    }
    return deduplicateFilterOptions(opts);
  }, [devices]);

  // Tag chips in the search bar take "key:value" form (e.g. "env:prod").
  // Plain text chips are kept visually but don't filter (matches DevicesPanel behavior).
  const selectedTagValues = useMemo(
    () =>
      selectedTags.flatMap(t => {
        const i = t.indexOf(':');
        return i > 0 ? [t.substring(i + 1)] : [];
      }),
    [selectedTags],
  );

  // Apply column filters + tag filters client-side on top of the search/tab-filtered list.
  // singleSelect mode skips the tab split and shows all matching devices.
  // In server mode there is nothing to apply: `devices` is already the answer
  // to this tab, this search and these filters.
  // Criteria mode is the same deal as server mode: `devices` is already the
  // answer — here, the set the rule resolves to.
  const passThrough = !!server || isCriteria;
  const baseDevices = passThrough ? devices : singleSelect ? client.filteredDevices : client.displayDevices;
  const devicesForTable = useMemo(() => {
    if (passThrough || (columnFilters.length === 0 && selectedTagValues.length === 0)) return baseDevices;
    return baseDevices.filter(d => {
      for (const f of columnFilters) {
        const values = f.value as string[];
        if (!values || values.length === 0) continue;
        const cell =
          f.id === 'status'
            ? d.status
            : f.id === 'os'
              ? d.osType
              : f.id === 'organization'
                ? d.organization
                : undefined;
        if (cell === undefined || !values.includes(cell)) return false;
      }
      if (selectedTagValues.length > 0) {
        const hasMatchingTag = (d.tags ?? []).some(tag => tag.values.some(v => selectedTagValues.includes(v)));
        if (!hasMatchingTag) return false;
      }
      return true;
    });
  }, [passThrough, baseDevices, columnFilters, selectedTagValues]);

  // Client-side `DeviceFilters`-shaped object — built from the prop list so
  // `useTagFilterModal` and `getDeviceFilterColumns` can drive the FilterModal
  // without a network round-trip.
  const clientDeviceFilters = useMemo<DeviceFilters>(() => {
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
        const vc = tagSeen.get(tag.key)!;
        for (const v of tag.values) vc.set(v, (vc.get(v) ?? 0) + 1);
      }
    }

    const tagKeys: Array<{ key: string; value: string; count: number }> = [];
    for (const [key, vc] of tagSeen) {
      for (const [value, count] of vc) {
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

  // Counting the rows on screen only describes the page the client happens to
  // hold; when the server is paging, it supplies the real facets instead.
  const deviceFilters = server?.filterOptions ?? clientDeviceFilters;

  const filterColumns = useMemo(() => getDeviceFilterColumns(deviceFilters), [deviceFilters]);

  // Adapter: useTagFilterModal expects a single `setParams({ statuses, osTypes, organizationIds, tags })`
  // call. We split it back into our local state.
  const handleSetParams = useCallback(
    (params: Record<string, any>) => {
      setColumnFilters([
        ...(params.statuses?.length ? [{ id: 'status', value: params.statuses }] : []),
        ...(params.osTypes?.length ? [{ id: 'os', value: params.osTypes }] : []),
        ...(params.organizationIds?.length ? [{ id: 'organization', value: params.organizationIds }] : []),
      ]);
      setSelectedTags(params.tags ?? []);
    },
    [setColumnFilters, setSelectedTags],
  );

  const {
    isOpen: tagsModalOpen,
    open: openTagsModal,
    close: closeTagsModal,
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

  const tagOptions = useMemo(() => selectedTags.map(t => ({ label: t, value: t })), [selectedTags]);

  // Map column filters → `{ status, os, organization }` shape that FilterModal expects on mobile.
  const tableFilters = useMemo(
    () => ({
      status: (columnFilters.find(f => f.id === 'status')?.value as string[]) ?? [],
      os: (columnFilters.find(f => f.id === 'os')?.value as string[]) ?? [],
      organization: (columnFilters.find(f => f.id === 'organization')?.value as string[]) ?? [],
    }),
    [columnFilters],
  );

  const handleTagRemove = useCallback(
    (value: string) => {
      setSelectedTags(selectedTags.filter(t => t !== value));
    },
    [selectedTags, setSelectedTags],
  );

  const handleClearAll = useCallback(() => {
    setSearchTerm('');
    setSelectedTags([]);
  }, [setSearchTerm, setSelectedTags]);

  const handleTagSubmit = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return;
      if (!selectedTags.includes(trimmed)) setSelectedTags([...selectedTags, trimmed]);
      setSearchTerm('');
    },
    [selectedTags, setSelectedTags, setSearchTerm],
  );

  const columns = useMemo<ColumnDef<Device>[]>(
    () => [
      {
        id: 'device',
        accessorKey: 'device',
        header: 'DEVICE',
        cell: ({ row }: { row: Row<Device> }) => {
          const device = row.original;
          const lastSeen = device.last_seen || device.lastSeen;
          return (
            <div className="flex items-center gap-3 h-20">
              <div className="flex h-8 w-8 items-center justify-center shrink-0 rounded-[6px] border border-ods-border">
                {renderDeviceTypeIcon(device.type, 'w-4 h-4 text-ods-text-secondary') ?? (
                  <MonitorIcon className="w-4 h-4 text-ods-text-secondary" />
                )}
              </div>
              <div className="flex flex-col truncate">
                <span className="text-h4 text-ods-text-primary truncate" title={device.displayName || device.hostname}>
                  {device.displayName || device.hostname}
                </span>
                <span
                  className="text-h6 text-ods-text-secondary truncate"
                  title={`Last Online: ${lastSeen ? formatRelativeTime(lastSeen) : 'unknown'}`}
                >
                  Last Online: {lastSeen ? formatRelativeTime(lastSeen) : 'unknown'}
                </span>
              </div>
            </div>
          );
        },
        enableSorting: false,
      },
      {
        id: 'organization',
        accessorKey: 'organization',
        header: 'CUSTOMER',
        cell: ({ row }: { row: Row<Device> }) => {
          const device = row.original;
          const fullImageUrl = getFullImageUrl(device.organizationImageUrl, device.organizationImageHash);
          return (
            <div className="flex items-center gap-3 min-w-0">
              <EntityImage
                src={fullImageUrl}
                alt={device.organization || 'Customer'}
                className="size-10 md:size-10 shrink-0"
              />
              <div className="flex min-w-0 flex-col justify-center">
                <span className="text-h4 text-ods-text-primary truncate" title={device.organization || ''}>
                  {device.organization || ''}
                </span>
                {device.organizationEmail && (
                  <span className="text-h6 text-ods-text-secondary truncate" title={device.organizationEmail}>
                    {device.organizationEmail}
                  </span>
                )}
              </div>
            </div>
          );
        },
        enableSorting: false,
        meta: {
          width: 'w-[320px]',
          hideAt: 'lg',
          filter: orgFilterOptions.length > 0 ? { options: orgFilterOptions, placement: 'bottom-end' } : undefined,
        },
      },
      {
        id: 'os',
        accessorKey: 'os',
        header: 'OS',
        cell: ({ row }: { row: Row<Device> }) => (
          <OSTypeBadge osType={row.original.osType} iconSize="w-4 h-4 md:w-6 md:h-6" />
        ),
        enableSorting: false,
        meta: {
          width: 'w-[200px] md:w-1/6',
          hideAt: 'md',
        },
      },
      {
        id: 'status',
        accessorKey: 'status',
        header: 'STATUS',
        cell: ({ row }: { row: Row<Device> }) => {
          const config = getDeviceStatusConfig(row.original.status);
          return <Tag label={config.label} variant={config.variant} className="w-min" />;
        },
        enableSorting: false,
        meta: {
          width: 'w-[160px]',
          filter: statusFilterOptions.length > 0 ? { options: statusFilterOptions } : undefined,
        },
      },
      {
        id: 'actions',
        cell: ({ row }: { row: Row<Device> }) => {
          const device = row.original;
          const disabledReason = isDeviceDisabled?.(device);

          if (disabledReason) {
            return (
              <div data-no-row-click className="flex items-center justify-end gap-2 w-full pointer-events-auto">
                <span className="max-md:hidden text-h6 text-ods-text-secondary text-right whitespace-pre-line">
                  {disabledReason}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  leftIcon={<PlusCircleIcon size={24} />}
                  className="text-ods-text-secondary shrink-0"
                  disabled
                />
              </div>
            );
          }

          const key = getDeviceKey(device);
          if (key === undefined) return null;
          // Server mode holds a page of the assignment, not the assignment, so
          // "already in?" is not a question this row can answer — it offers the
          // action its tab implies and lets the idempotent mutation settle it.
          const isSelected = !server && selectedIds.has(key);

          if (activeSubTab === 'selected') {
            return (
              <div data-no-row-click className="flex items-center justify-end w-full pointer-events-auto">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => toggleDevice(device)}
                  leftIcon={<TrashIcon size={24} />}
                  className="text-ods-error hover:opacity-80"
                  disabled={disabled}
                />
              </div>
            );
          }

          return (
            <div data-no-row-click className="flex items-center justify-end w-full pointer-events-auto">
              <Button
                variant="outline"
                size="icon"
                onClick={() => toggleDevice(device)}
                leftIcon={isSelected ? <CheckCircleIcon size={24} /> : <PlusCircleIcon size={24} />}
                // Selected is a STATE, not an affordance: the yellow fill already
                // says "this one is in", so it holds still under the cursor. The
                // hover repeats on both bg and border because `variant="outline"`
                // ships its own `hover:bg-ods-bg-hover` / `hover:border-ods-border-hover`
                // — restating them at the same value is what neutralizes them.
                className={
                  isSelected
                    ? 'text-ods-accent border-ods-accent hover:border-ods-accent bg-ods-open-yellow-secondary hover:bg-ods-open-yellow-secondary'
                    : 'text-ods-text-secondary hover:text-ods-text-primary'
                }
                disabled={disabled}
              />
            </div>
          );
        },
        enableSorting: false,
        meta: { width: 'w-12 md:w-auto md:min-w-[130px] shrink-0 flex-none', align: 'right' },
      },
    ],
    [
      statusFilterOptions,
      orgFilterOptions,
      isDeviceDisabled,
      getDeviceKey,
      selectedIds,
      activeSubTab,
      toggleDevice,
      disabled,
      server,
    ],
  );

  const visibleColumns = useMemo(() => {
    // Nothing on a criteria row is actionable — membership follows the rule, so
    // an add/remove button there would promise an edit the mode cannot make.
    const hidden = new Set([...(hideColumns ?? []), ...(isCriteria ? ['actions'] : [])]);
    if (hidden.size === 0) return columns;
    return columns.filter(c => !c.id || !hidden.has(c.id));
  }, [columns, hideColumns, isCriteria]);

  const table = useDataTable<Device>({
    data: devicesForTable,
    columns: visibleColumns,
    getRowId: row => String(getDeviceKey(row) ?? row.id),
    enableSorting: false,
    state: { columnFilters },
    onColumnFiltersChange: handleTableColumnFiltersChange,
  });

  const selectedCount = server ? server.selectedCount : selectedIds.size;

  // Per-row className whose value differs by selection state. DataTableRow is
  // React.memo'd on `className`, so only rows whose selection actually flipped
  // re-render — the rest keep their cached cells (with stable toggleDevice).
  const rowClassName = useCallback(
    (device: Device): string => {
      const key = getDeviceKey(device);
      if (key === undefined) return '';
      return selectedIds.has(key) ? 'is-selected' : '';
    },
    [selectedIds, getDeviceKey],
  );

  const assignTabs: TabItem[] = useMemo(
    () => [
      {
        id: 'available',
        label: 'Available Devices',
        icon: MonitorIcon,
        // The table is rendered outside TabContent now — these `component` slots
        // exist only because TabNavigation/TabItem require them. Render nothing.
        component: () => null,
      },
      {
        id: 'selected',
        // Server mode counts the whole assignment, not the page in hand.
        label: singleSelect ? `Selected Device (${selectedCount})` : `Selected Devices (${selectedCount})`,
        icon: CheckCircleIcon,
        component: () => null,
      },
    ],
    [selectedCount, singleSelect],
  );

  const availableInfiniteScroll = activeSubTab === 'available' ? infiniteScroll : undefined;

  // Column headers over nothing are just noise — drop them when the list is
  // empty. Except when the emptiness is the RESULT of narrowing (search, tag
  // chips, column funnels): the funnels live in that header, so tearing it down
  // would strip the only way to undo the filter that emptied the table. While
  // loading, the skeleton rows are the content the header belongs to.
  // The design (460:71435) puts the bulk action where a table normally shows its
  // row count — the right end of the column header — instead of on a line of its
  // own above the table. Null in single-select mode, and on the Selected tab
  // until there is something to remove; the row count takes the slot back then.
  const bulkAction =
    singleSelect || isCriteria ? null : activeSubTab === 'available' ? (
      <button
        type="button"
        onClick={addAllDevices}
        disabled={disabled}
        className="text-h6 underline text-ods-accent hover:text-ods-accent-hover bg-transparent border-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Add All Devices
      </button>
    ) : selectedCount > 0 ? (
      <button
        type="button"
        onClick={removeAllSelected}
        disabled={disabled}
        className="text-h6 underline text-ods-error hover:text-ods-error-hover bg-transparent border-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Remove {server ? (server.totalCount ?? devicesForTable.length) : selectedIds.size} Devices
      </button>
    ) : null;

  const hasActiveFilter = columnFilters.length > 0 || selectedTags.length > 0 || searchTerm.trim().length > 0;
  // In criteria mode the header's row count is the readout of the rule ("42
  // devices"), so it stays even at zero — that IS the answer the user is after.
  const showHeader = isCriteria || loading || devicesForTable.length > 0 || hasActiveFilter;

  const deviceTable = (
    <DataTable table={table}>
      {showHeader && (
        <DataTable.Header
          rightSlot={
            bulkAction ?? <DataTable.RowCount itemName="device" totalCount={totalCount ?? server?.totalCount} />
          }
        />
      )}
      <DataTable.Body
        loading={loading}
        skeletonRows={8}
        emptyMessage={
          isCriteria
            ? 'No devices match these criteria'
            : activeSubTab === 'selected'
              ? 'No devices selected'
              : 'No devices found'
        }
        rowClassName={rowClassName}
      />
      {availableInfiniteScroll && (
        <DataTable.InfiniteFooter
          hasNextPage={availableInfiniteScroll.hasNextPage}
          isFetchingNextPage={availableInfiniteScroll.isFetchingNextPage}
          onLoadMore={availableInfiniteScroll.onLoadMore}
          skeletonRows={availableInfiniteScroll.skeletonRows}
        />
      )}
    </DataTable>
  );

  return (
    // The page-level stack (info bar → mode picker → the picker card) uses
    // `--spacing-system-l`, the token every other stacked page surface in the app
    // separates its blocks with (16px mobile / 24px desktop).
    <div className="flex flex-col gap-[var(--spacing-system-l)]">
      {headerContent}

      {showSelectionModeRadio && (
        <DeviceSelectionModeRadio value={selectionMode} onChange={onSelectionModeChange} disabled={disabled} />
      )}

      {/* Criteria mode (design 460:85294) has no card at all: the rule's fields
          and the table it previews sit straight on the page, in the same 24px
          stack as everything above them. There is nothing to frame — no tab
          strip to seat, and no search row to inset with it. */}
      {isCriteria ? (
        <>
          {criteriaContent}
          {deviceTable}
        </>
      ) : (
        /* Design 460:71435 frames the picker as ONE bordered card: the tab strip
           sits flush against the top edge with its own underline doubling as the
           divider, and the search row and table are inset below it.
           Deliberately NOT `overflow-clip` (which the Figma export puts here to
           round the tab strip's corners): the column-filter dropdowns are
           absolutely positioned INSIDE this box rather than portaled, so clipping
           it would cut them off whenever the table is short. The tab strip clips
           its own corners instead — it is the only child that reaches the radius. */
        <div className="flex flex-col rounded-[6px] border border-ods-border bg-ods-bg">
          {!singleSelect && (
            <TabNavigation
              tabs={assignTabs}
              activeTab={activeSubTab}
              onTabChange={handleTabChange}
              className="rounded-t-[6px] overflow-clip"
            />
          )}

          <div className="flex flex-col gap-[var(--spacing-system-m)] p-[var(--spacing-system-m)]">
            <DevicesFilterToolbar
              sticky={false}
              searchValue={searchTerm}
              onSearchChange={setSearchTerm}
              tags={tagOptions}
              onTagRemove={handleTagRemove}
              onClearAll={handleClearAll}
              onSubmit={handleTagSubmit}
              isMdUp={isMdUp}
              onOpenFilterModal={openTagsModal}
              isFilterModalOpen={tagsModalOpen}
              onCloseFilterModal={closeTagsModal}
              filterGroups={filterGroups}
              onFilterChange={handleModalFilterChange}
              currentFilters={!isMdUp ? tableFilters : undefined}
              tagFilterKeys={tagFilterKeys}
              selectedTags={selectedTags}
              onTagsChange={handleModalTagsChange}
            />

            {deviceTable}
          </div>
        </div>
      )}
    </div>
  );
}
