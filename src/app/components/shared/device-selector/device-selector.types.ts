import type { ColumnFiltersState } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { ReactNode } from 'react';
import type { Device, DeviceFilters } from '@/app/(app)/devices/types/device.types';

export type SubTab = 'available' | 'selected';

/** The narrowing the picker is showing, in the component's own vocabulary. */
export interface DeviceSelectorNarrowing {
  /** Column funnels (status / customer / os), TanStack-shaped. */
  columnFilters: ColumnFiltersState;
  /** Tag chips in the search bar, `key:value`. */
  tags: string[];
}

/**
 * Hands the picker's state to a parent that answers it from the server.
 *
 * Present ⇒ the component stops deriving anything from the `devices` array:
 * `devices` IS the current tab's page, the Available/Selected split is two
 * server queries rather than one list partitioned by `selectedIds`, and search,
 * filters and the bulk actions are questions for the backend. Absent ⇒ every
 * bit of that stays client-side exactly as before, which is what the other
 * consumers (Run/Test Script, monitoring) rely on.
 *
 * The row action is add-or-remove by tab, not a toggle: with only a page of the
 * assignment in hand, "is this one selected?" is not a question the client can
 * answer — so Available always offers add (the mutation is idempotent) and
 * Selected always offers remove.
 */
export interface DeviceSelectorServer {
  activeTab: SubTab;
  onTabChange: (tab: SubTab) => void;
  /** Search box value. The parent debounces it into its query. */
  search: string;
  onSearchChange: (value: string) => void;
  narrowing: DeviceSelectorNarrowing;
  onNarrowingChange: (next: DeviceSelectorNarrowing) => void;
  /**
   * Options for the column funnels. Rows are paged, so options derived from
   * them would only ever offer what page one happens to contain.
   */
  filterOptions?: DeviceFilters | null;
  /** Size of the whole assignment — the "Selected Devices (N)" label. */
  selectedCount: number;
  /** Server-side count for the list on screen, for the header's row count. */
  totalCount?: number;
  /** Row actions. Committed immediately; there is no Save to batch them into. */
  onAdd: (device: Device) => void;
  onRemove: (device: Device) => void;
  /** Header bulk actions — resolved server-side over the current narrowing. */
  onAddAll: () => void;
  onRemoveAll: () => void;
}

export interface InfiniteScrollConfig {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
  skeletonRows: number;
}

export interface DeviceSelectorProps {
  /** Devices to display. Consumer controls fetching and pre-filtering. */
  devices: Device[];
  /** Whether the device list is loading. */
  loading: boolean;
  /** Set of currently selected device keys (string). Required unless `readOnly`. */
  selectedIds?: Set<string>;
  /** Called when selection changes. Required unless `readOnly`. */
  onSelectionChange?: (ids: Set<string>) => void;
  /** Extract the unique string key for selection from a device. Defaults to `d.machineId ?? d.id`. */
  getDeviceKey?: (device: Device) => string | undefined;
  /**
   * Read-only viewer mode. Skips Available/Selected tabs, selection radio and
   * +/- action buttons. The consumer no longer needs `selectedIds` /
   * `onSelectionChange`. Combine with `hideColumns: ['actions']` to remove the
   * trailing action column entirely.
   */
  readOnly?: boolean;
  /** Infinite scroll config for the available tab. */
  infiniteScroll?: InfiniteScrollConfig;
  /** Disable all interactions (e.g. during save). */
  disabled?: boolean;
  /** Show selection mode radio group. Default: true. */
  showSelectionModeRadio?: boolean;
  /** Extra content rendered above the selection radio / tabs (e.g. ScheduleInfoBar). */
  headerContent?: ReactNode;
  /** Table rowKey. Default: "id". */
  rowKey?: string;
  /** "replace" replaces entire selection on Add All; "merge" adds to existing. Default: "merge". */
  addAllBehavior?: 'replace' | 'merge';
  /** Allow only one device to be selected at a time. Default: false. */
  singleSelect?: boolean;
  /** Return a tooltip string if the device should be disabled, or undefined if enabled. */
  isDeviceDisabled?: (device: Device) => string | undefined;
  /** Column ids to drop from the table (e.g. `['organization', 'status']` to leave only device + os). */
  hideColumns?: string[];
  /**
   * Switches the picker to server-driven mode — see {@link DeviceSelectorServer}.
   * Omit for the client-side behaviour every other consumer uses.
   */
  server?: DeviceSelectorServer;
}
