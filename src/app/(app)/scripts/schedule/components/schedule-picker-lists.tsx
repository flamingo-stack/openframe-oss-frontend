'use client';

import { useCallback, useMemo } from 'react';
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
import { DeviceSelector } from '@/app/components/shared/device-selector';
import type { DeviceSelectorNarrowing, SubTab } from '@/app/components/shared/device-selector/device-selector.types';
import {
  scheduleDevicePickerRelayAssignedFragment,
  scheduleDevicePickerRelayAssignedQuery,
  scheduleDevicePickerRelayFragment,
  scheduleDevicePickerRelayQuery,
} from '@/graphql/scripts/schedule-device-picker-relay';
import { useScheduleDeviceFilters } from '../hooks/use-schedule-device-filters';
import {
  DEVICE_PICKER_PAGE_SIZE,
  toAvailableDeviceFilter,
  toDevices,
  toRelayFilter,
} from '../utils/schedule-device-filters';

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
 * server-narrowed connection.
 *
 * They are read TOGETHER rather than one per active tab: switching tabs then
 * costs nothing and never unmounts the picker (which would drop the search box
 * mid-typing). Two pages of twenty is also less than the page used to pull — it
 * fetched up to 200 candidates plus the entire assignment before rendering.
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
  // The halves are read under DIFFERENT filters, not one: Available is scoped to
  // script-targetable statuses (no PENDING_DELETION — see
  // `toAvailableDeviceFilter`), while Selected keeps the narrowing as typed, so
  // a device that went into pending deletion after being assigned stays visible
  // and removable. Everything keyed by these filters — the mutation updaters and
  // `refreshLists` in `useScheduleDeviceAssignment` — splits the same way.
  const availableVariables = {
    scheduleId,
    filter: toRelayFilter(toAvailableDeviceFilter(deferredFilter)),
    search: deferredSearch || null,
    first: DEVICE_PICKER_PAGE_SIZE,
    after: null,
  };
  const assignedVariables = {
    scheduleId,
    filter: toRelayFilter(deferredFilter),
    search: deferredSearch || null,
    first: DEVICE_PICKER_PAGE_SIZE,
    after: null,
  };

  // No `fetchKey`. A single +/− is written straight into the store by the
  // mutation's updaters, so these re-render from it once and are then already
  // right; only the bulk actions, which replace the assignment wholesale, go
  // back to the network.
  const availableData = useLazyLoadQuery<AvailableQueryType>(scheduleDevicePickerRelayQuery, availableVariables, {
    fetchPolicy: 'store-and-network',
  });
  const assignedData = useLazyLoadQuery<AssignedQueryType>(scheduleDevicePickerRelayAssignedQuery, assignedVariables, {
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

  const availableConnection = (available.data as AvailableFragmentData | null)?.availableDevices;
  const assignedConnection = (assigned.data as AssignedFragmentData | null)?.assignedDevices;

  const availableRows = useMemo(() => toDevices(availableConnection?.edges), [availableConnection?.edges]);
  const assignedRows = useMemo(() => toDevices(assignedConnection?.edges), [assignedConnection?.edges]);

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
    for (const edge of availableConnection?.edges ?? []) {
      if (edge?.assigned && edge.node) keys.add(edge.node.machineId || edge.node.id);
    }
    return keys;
  }, [availableConnection?.edges]);

  const isAvailable = activeTab === 'available';
  const rows = isAvailable ? availableRows : assignedRows;
  const totalCount = (isAvailable ? availableConnection : assignedConnection)?.filteredCount;
  const hasNext = isAvailable ? available.hasNext : assigned.hasNext;
  const isLoadingNext = isAvailable ? available.isLoadingNext : assigned.isLoadingNext;
  const loadNext = isAvailable ? available.loadNext : assigned.loadNext;

  const loadMore = useCallback(() => {
    if (hasNext && !isLoadingNext) loadNext(DEVICE_PICKER_PAGE_SIZE);
  }, [hasNext, isLoadingNext, loadNext]);

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
    <DeviceSelector
      devices={rows}
      loading={false}
      disabled={busy}
      showSelectionModeRadio={false}
      // Only meaningful on Available: every row on the Selected tab is assigned
      // by definition, and the Selected tab shows removals by dropping the row.
      selectedIds={isAvailable ? selectedKeys : undefined}
      infiniteScroll={{
        hasNextPage: hasNext,
        isFetchingNextPage: isLoadingNext,
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
        // The WHOLE assignment, not `assignedConnection.filteredCount`: the tab
        // label names what is in the schedule, and that does not drop because
        // the user typed in the search box. The narrowed number belongs to the
        // list, which reports it itself.
        //
        // Read straight off the record, with no local offset added on top: an
        // unconfirmed click already moved it, through the mutation's optimistic
        // layer (`assignmentUpdaters`), so the label keeps up with the row
        // without anyone counting the same click twice.
        selectedCount: assignedData.scriptSchedule?.deviceCount ?? 0,
        totalCount: totalCount ?? undefined,
        onAdd,
        onRemove,
        onAddAll,
        onRemoveAll,
      }}
    />
  );
}
