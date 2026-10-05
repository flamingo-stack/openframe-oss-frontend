'use client';

import { useCallback, useMemo } from 'react';
import type { deviceSelectorFields_machine$key } from '@/__generated__/deviceSelectorFields_machine.graphql';
import type { Device, DeviceFilters } from '@/app/(app)/devices/types/device.types';
import { DeviceSelector } from './device-selector';
import { DeviceSelectorSkeleton } from './device-selector-skeleton';
import type { DeviceSelectorNarrowing, SubTab } from './device-selector.types';
import { DEVICE_PICKER_PAGE_SIZE, toDevices } from './picker-narrowing';

/**
 * One edge of a picker connection, as both halves select it: the device
 * selector step of the field ladder plus the two ids the selection marks are
 * keyed by. `assigned` is the Available half's per-row flag; the Selected half
 * has none, every row there being assigned by definition.
 */
export interface PickerEdge {
  readonly assigned?: boolean;
  readonly node:
    | (deviceSelectorFields_machine$key & { readonly id: string; readonly machineId: string | null | undefined })
    | null
    | undefined;
}

export interface PickerConnection {
  readonly filteredCount: number;
  readonly edges: ReadonlyArray<PickerEdge | null | undefined>;
}

/** One half of the picker — a connection plus its pagination handle. */
export interface PickerHalf {
  connection: PickerConnection | null | undefined;
  hasNext: boolean;
  isLoadingNext: boolean;
  loadNext: (count: number) => unknown;
}

interface ServerDevicePickerListsProps {
  available: PickerHalf;
  selected: PickerHalf;
  /**
   * The WHOLE assignment, not `selected.connection.filteredCount`: the tab label
   * names what is assigned, and that does not drop because the user typed in
   * the search box. The narrowed number belongs to the list, which reports it
   * itself.
   */
  selectedCount: number;
  filterOptions: DeviceFilters;
  activeTab: SubTab;
  onTabChange: (tab: SubTab) => void;
  search: string;
  onSearchChange: (value: string) => void;
  narrowing: DeviceSelectorNarrowing;
  onNarrowingChange: (next: DeviceSelectorNarrowing) => void;
  /** Bulk work only — a single +/− must not lock the page it happens on. */
  busy: boolean;
  onAdd: (device: Device) => void;
  onRemove: (device: Device) => void;
  onAddAll: () => void;
  onRemoveAll: () => void;
  isDeviceDisabled?: (device: Device) => string | undefined;
}

/**
 * Both lists of a server-driven picker over an owner's `availableDevices` /
 * `assignedDevices` pair — the wiring from two paginated connections to
 * `DeviceSelector`'s server mode, shared by every owner of such a pair (script
 * schedules, software bundles). The owner's component reads its own two
 * queries and hands the halves in.
 *
 * The halves are read TOGETHER rather than one per active tab: switching tabs
 * then costs nothing and never unmounts the picker (which would drop the search
 * box mid-typing).
 */
export function ServerDevicePickerLists({
  available,
  selected,
  selectedCount,
  filterOptions,
  activeTab,
  onTabChange,
  search,
  onSearchChange,
  narrowing,
  onNarrowingChange,
  busy,
  onAdd,
  onRemove,
  onAddAll,
  onRemoveAll,
  isDeviceDisabled,
}: ServerDevicePickerListsProps) {
  const availableEdges = available.connection?.edges;
  const selectedEdges = selected.connection?.edges;

  const availableRows = useMemo(() => toDevices(availableEdges), [availableEdges]);
  const selectedRows = useMemo(() => toDevices(selectedEdges), [selectedEdges]);

  // Which rows are marked "in". Taken from the Available connection's per-row
  // `assigned` flag alone — the one place that answers it, and the only list
  // these marks are used on, since every row of the Selected tab is assigned by
  // definition.
  //
  // No local overlay on top: a click flips that very flag in the store (see
  // `assignmentUpdaters`), so what the row shows is what the store says, before
  // and after the response alike.
  const selectedKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const edge of availableEdges ?? []) {
      if (edge?.assigned && edge.node) keys.add(edge.node.machineId || edge.node.id);
    }
    return keys;
  }, [availableEdges]);

  const isAvailable = activeTab === 'available';
  const half = isAvailable ? available : selected;

  const loadMore = useCallback(() => {
    if (half.hasNext && !half.isLoadingNext) half.loadNext(DEVICE_PICKER_PAGE_SIZE);
  }, [half]);

  return (
    <DeviceSelector
      devices={isAvailable ? availableRows : selectedRows}
      loading={false}
      disabled={busy}
      showSelectionModeRadio={false}
      // Only meaningful on Available: every row on the Selected tab is assigned
      // by definition, and the Selected tab shows removals by dropping the row.
      selectedIds={isAvailable ? selectedKeys : undefined}
      isDeviceDisabled={isDeviceDisabled}
      infiniteScroll={{
        hasNextPage: half.hasNext,
        isFetchingNextPage: half.isLoadingNext,
        onLoadMore: loadMore,
        skeletonRows: 2,
      }}
      server={{
        activeTab,
        onTabChange,
        search,
        onSearchChange,
        narrowing,
        onNarrowingChange,
        filterOptions,
        // Read straight off the owner record, with no local offset added on top:
        // an unconfirmed click already moved it, through the mutation's
        // optimistic layer (`assignmentUpdaters`), so the label keeps up with the
        // row without anyone counting the same click twice.
        selectedCount,
        totalCount: half.connection?.filteredCount,
        onAdd,
        onRemove,
        onAddAll,
        onRemoveAll,
      }}
    />
  );
}

/**
 * The real picker in its loading state, so there is no separate skeleton to
 * drift: locked with `disabled`, which blocks every interaction and leaves the
 * picker's SHAPE alone — the Available / Selected tab strip included.
 */
export function ServerDevicePickerSkeleton() {
  return <DeviceSelectorSkeleton showSelectionModeRadio={false} />;
}
