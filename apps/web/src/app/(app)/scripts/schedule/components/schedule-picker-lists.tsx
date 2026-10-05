'use client';

import { useLazyLoadQuery, usePaginationFragment } from 'react-relay';
import type {
  scheduleDevicePickerRelay_available$data as AvailableFragmentData,
  scheduleDevicePickerRelay_available$key as AvailableFragmentKey,
} from '@/__generated__/scheduleDevicePickerRelay_available.graphql';
import type {
  scheduleDevicePickerRelay_schedule$data as AssignedFragmentData,
  scheduleDevicePickerRelay_schedule$key as AssignedFragmentKey,
} from '@/__generated__/scheduleDevicePickerRelay_schedule.graphql';
import type { scheduleDevicePickerRelayAssignedPaginationQuery as AssignedPaginationQueryType } from '@/__generated__/scheduleDevicePickerRelayAssignedPaginationQuery.graphql';
import type { scheduleDevicePickerRelayAssignedQuery as AssignedQueryType } from '@/__generated__/scheduleDevicePickerRelayAssignedQuery.graphql';
import type { scheduleDevicePickerRelayPaginationQuery as AvailablePaginationQueryType } from '@/__generated__/scheduleDevicePickerRelayPaginationQuery.graphql';
import type { scheduleDevicePickerRelayQuery as AvailableQueryType } from '@/__generated__/scheduleDevicePickerRelayQuery.graphql';
import type { Device, DeviceFilterInput } from '@/app/(app)/devices/types/device.types';
import type { DeviceSelectorNarrowing, SubTab } from '@/app/components/shared/device-selector/device-selector.types';
import { DEVICE_PICKER_PAGE_SIZE } from '@/app/components/shared/device-selector/picker-narrowing';
import { ServerDevicePickerLists } from '@/app/components/shared/device-selector/server-device-picker-lists';
import { toRelayDeviceFilter } from '@/graphql/devices/to-relay-device-filter';
import {
  scheduleDevicePickerRelayAssignedFragment,
  scheduleDevicePickerRelayAssignedQuery,
  scheduleDevicePickerRelayFragment,
  scheduleDevicePickerRelayQuery,
} from '@/graphql/scripts/schedule-device-picker-relay';
import { useScheduleDeviceFilters } from '../hooks/use-schedule-device-filters';

/**
 * The info bar and the mode radio are rendered by the PAGE, above the subtree
 * that swaps — so neither half of the editor draws them, and neither carries
 * `headerContent`.
 */
interface SchedulePickerListsProps {
  scheduleId: string;
  activeTab: SubTab;
  onTabChange: (tab: SubTab) => void;
  search: string;
  onSearchChange: (value: string) => void;
  narrowing: DeviceSelectorNarrowing;
  onNarrowingChange: (next: DeviceSelectorNarrowing) => void;
  /** Deferred narrowing — what the two lists are actually reading. */
  deferredFilter: DeviceFilterInput;
  deferredSearch: string;
  /** Bulk work only — a single +/− must not lock the page it happens on. */
  busy: boolean;
  onAdd: (device: Device) => void;
  onRemove: (device: Device) => void;
  onAddAll: () => void;
  onRemoveAll: () => void;
}

/**
 * The "Select Specific Devices" half — both lists of the picker, each its own
 * server-narrowed connection over the schedule.
 *
 * Two pages of twenty is less than the page used to pull — it fetched up to 200
 * candidates plus the entire assignment before rendering.
 */
export function SchedulePickerLists({
  scheduleId,
  activeTab,
  onTabChange,
  search,
  onSearchChange,
  narrowing,
  onNarrowingChange,
  deferredFilter,
  deferredSearch,
  busy,
  onAdd,
  onRemove,
  onAddAll,
  onRemoveAll,
}: SchedulePickerListsProps) {
  const variables = {
    scheduleId,
    filter: toRelayDeviceFilter(deferredFilter),
    search: deferredSearch || null,
    first: DEVICE_PICKER_PAGE_SIZE,
    after: null,
  };

  // No `fetchKey`. A single +/− is written straight into the store by the
  // mutation's updaters, so these re-render from it once and are then already
  // right; only the bulk actions, which replace the assignment wholesale, go
  // back to the network.
  const availableData = useLazyLoadQuery<AvailableQueryType>(scheduleDevicePickerRelayQuery, variables, {
    fetchPolicy: 'store-and-network',
  });
  const assignedData = useLazyLoadQuery<AssignedQueryType>(scheduleDevicePickerRelayAssignedQuery, variables, {
    fetchPolicy: 'store-and-network',
  });

  const available = usePaginationFragment<AvailablePaginationQueryType, AvailableFragmentKey>(
    scheduleDevicePickerRelayFragment,
    availableData.scriptSchedule ?? null,
  );
  const assigned = usePaginationFragment<AssignedPaginationQueryType, AssignedFragmentKey>(
    scheduleDevicePickerRelayAssignedFragment,
    assignedData.scriptSchedule ?? null,
  );

  // Server-resolved facets rather than counts taken off the rows in hand: with
  // the server paging, options derived from the current page would only ever
  // offer what page one happens to contain.
  //
  // Scoped to the ACTIVE half (`assignedDeviceFilters` / `availableDeviceFilters`
  // on the schedule), not to the fleet: the funnel then offers only values that
  // narrow the list beside it — a Windows schedule no longer lists macOS, and the
  // Selected tab no longer offers the customers of machines it doesn't hold.
  //
  // DEFERRED, like the two lists: this hook suspends now, so feeding it the live
  // narrowing would drop the whole picker — search box, tab state and all — to
  // `SchedulePickerSkeleton` on every funnel click. Facets that lag the rows by
  // one transition are consistent with them; facets that blank the picker are not.
  const filterOptions = useScheduleDeviceFilters(
    scheduleId,
    activeTab === 'selected' ? 'assigned' : 'available',
    // Both halves in one read: the tab then stays out of the query variables,
    // so switching it costs nothing — see the query.
    { prefetchOtherHalf: true },
  );

  return (
    <ServerDevicePickerLists
      available={{
        connection: (available.data as AvailableFragmentData | null)?.availableDevices,
        hasNext: available.hasNext,
        isLoadingNext: available.isLoadingNext,
        loadNext: available.loadNext,
      }}
      selected={{
        connection: (assigned.data as AssignedFragmentData | null)?.assignedDevices,
        hasNext: assigned.hasNext,
        isLoadingNext: assigned.isLoadingNext,
        loadNext: assigned.loadNext,
      }}
      // The WHOLE assignment: the tab label names what is in the schedule, and
      // that does not drop because the user typed in the search box.
      selectedCount={assignedData.scriptSchedule?.deviceCount ?? 0}
      filterOptions={filterOptions}
      activeTab={activeTab}
      onTabChange={onTabChange}
      search={search}
      onSearchChange={onSearchChange}
      narrowing={narrowing}
      onNarrowingChange={onNarrowingChange}
      busy={busy}
      onAdd={onAdd}
      onRemove={onRemove}
      onAddAll={onAddAll}
      onRemoveAll={onRemoveAll}
    />
  );
}
