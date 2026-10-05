'use client';

import { graphql, useLazyLoadQuery, usePaginationFragment } from 'react-relay';
import type {
  bundlePickerLists_assigned$data as AssignedFragmentData,
  bundlePickerLists_assigned$key as AssignedFragmentKey,
} from '@/__generated__/bundlePickerLists_assigned.graphql';
import type {
  bundlePickerLists_available$data as AvailableFragmentData,
  bundlePickerLists_available$key as AvailableFragmentKey,
} from '@/__generated__/bundlePickerLists_available.graphql';
import type { bundlePickerListsAssignedPaginationQuery as AssignedPaginationQueryType } from '@/__generated__/bundlePickerListsAssignedPaginationQuery.graphql';
import type { bundlePickerListsAssignedQuery as AssignedQueryType } from '@/__generated__/bundlePickerListsAssignedQuery.graphql';
import type { bundlePickerListsAvailablePaginationQuery as AvailablePaginationQueryType } from '@/__generated__/bundlePickerListsAvailablePaginationQuery.graphql';
import type { bundlePickerListsAvailableQuery as AvailableQueryType } from '@/__generated__/bundlePickerListsAvailableQuery.graphql';
import type { Device, DeviceFilterInput } from '@/app/(app)/devices/types/device.types';
import { useRetryKey } from '@/app/components/shared';
import type { AssignmentOwner } from '@/app/components/shared/device-selector/assignment-updaters';
import type { DeviceSelectorNarrowing, SubTab } from '@/app/components/shared/device-selector/device-selector.types';
import { DEVICE_PICKER_PAGE_SIZE } from '@/app/components/shared/device-selector/picker-narrowing';
import { ServerDevicePickerLists } from '@/app/components/shared/device-selector/server-device-picker-lists';
import { toRelayDeviceFilter } from '@/graphql/devices/to-relay-device-filter';
import { useBundleDeviceFilters } from './use-bundle-device-filters';

/**
 * The `@connection` keys of the two fragments below — what the store updaters
 * of a single +/− (`assignmentUpdaters`) address the picker's lists by.
 */
export const BUNDLE_PICKER_CONNECTION_KEYS: AssignmentOwner['keys'] = {
  available: 'bundlePickerLists_availableDevices',
  assigned: 'bundlePickerLists_assignedDevices',
};

/**
 * The "Available Devices" half of the bundle's device picker. Search, filters
 * and paging live on the server, so what the user sees IS the full candidate
 * set — which is what makes "Add All Devices" honest: the same `filter` /
 * `search` go to `addAllDevicesToSoftwareBundle`, which resolves the set itself.
 *
 * `assigned` is selected on the EDGE: a fact about this device's relationship to
 * THIS bundle, not about the machine. The list marks assigned rows rather than
 * excluding them, so the picker pre-checks them instead of offering to add what
 * is already in.
 */
export const bundlePickerListsAvailableQuery = graphql`
  query bundlePickerListsAvailableQuery(
    $bundleId: ID!
    $filter: DeviceFilterInput
    $search: String
    $first: Int!
    $after: String
  ) {
    softwareBundle(id: $bundleId) {
      id
      ...bundlePickerLists_available @arguments(filter: $filter, search: $search, first: $first, after: $after)
    }
  }
`;

const availableFragment = graphql`
  fragment bundlePickerLists_available on SoftwareBundle
  @refetchable(queryName: "bundlePickerListsAvailablePaginationQuery")
  @argumentDefinitions(
    filter: { type: "DeviceFilterInput" }
    search: { type: "String" }
    first: { type: "Int", defaultValue: 20 }
    after: { type: "String" }
  ) {
    availableDevices(filter: $filter, search: $search, first: $first, after: $after)
      @connection(key: "bundlePickerLists_availableDevices") {
      filteredCount
      edges {
        assigned
        node {
          # Step 2 of the device field ladder (device-selector-fields.ts) — a row
          # plus the hardware ids and customer contact DeviceSelector shows.
          ...deviceSelectorFields_machine
          # The key the picker holds its selection marks by, read per edge
          # without flattening a Device first.
          id
          machineId
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

/**
 * The "Selected Devices" half — the bundle's current assignment under the
 * picker's own search and filters. `deviceCount` sits on the bundle rather than
 * inside the connection because it is what the "Selected Devices (N)" tab label
 * counts: the WHOLE assignment, which does not shrink because the user typed in
 * the search box.
 */
export const bundlePickerListsAssignedQuery = graphql`
  query bundlePickerListsAssignedQuery(
    $bundleId: ID!
    $filter: DeviceFilterInput
    $search: String
    $first: Int!
    $after: String
  ) {
    softwareBundle(id: $bundleId) {
      id
      deviceCount
      ...bundlePickerLists_assigned @arguments(filter: $filter, search: $search, first: $first, after: $after)
    }
  }
`;

const assignedFragment = graphql`
  fragment bundlePickerLists_assigned on SoftwareBundle
  @refetchable(queryName: "bundlePickerListsAssignedPaginationQuery")
  @argumentDefinitions(
    filter: { type: "DeviceFilterInput" }
    search: { type: "String" }
    first: { type: "Int", defaultValue: 20 }
    after: { type: "String" }
  ) {
    assignedDevices(filter: $filter, search: $search, first: $first, after: $after)
      @connection(key: "bundlePickerLists_assignedDevices") {
      filteredCount
      edges {
        node {
          ...deviceSelectorFields_machine
          id
          machineId
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

interface BundlePickerListsProps {
  bundleId: string;
  /** The form's own scope — the OS the chosen packages install on, and live devices only. */
  scope: DeviceFilterInput;
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
  isDeviceDisabled?: (device: Device) => string | undefined;
}

/**
 * Both lists of the bundle's device picker, each its own server-narrowed
 * connection over the bundle. Suspends — the picker renders it under its own
 * boundary.
 */
export function BundlePickerLists({
  bundleId,
  scope,
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
  isDeviceDisabled,
}: BundlePickerListsProps) {
  const retryKey = useRetryKey();
  const variables = {
    bundleId,
    filter: toRelayDeviceFilter(deferredFilter),
    search: deferredSearch || null,
    first: DEVICE_PICKER_PAGE_SIZE,
    after: null,
  };

  // No refetch on a single +/−: the mutation's updaters write it straight into
  // the store, so these re-render from it once and are then already right; only
  // the bulk actions, which replace the assignment wholesale, go back to the
  // network. `retryKey` is the boundary's retry, which does have to refetch.
  const availableData = useLazyLoadQuery<AvailableQueryType>(bundlePickerListsAvailableQuery, variables, {
    fetchPolicy: 'store-and-network',
    fetchKey: retryKey,
  });
  const assignedData = useLazyLoadQuery<AssignedQueryType>(bundlePickerListsAssignedQuery, variables, {
    fetchPolicy: 'store-and-network',
    fetchKey: retryKey,
  });

  const available = usePaginationFragment<AvailablePaginationQueryType, AvailableFragmentKey>(
    availableFragment,
    availableData.softwareBundle ?? null,
  );
  const assigned = usePaginationFragment<AssignedPaginationQueryType, AssignedFragmentKey>(
    assignedFragment,
    assignedData.softwareBundle ?? null,
  );

  // Scoped to the ACTIVE half of THIS bundle, within the form's scope — so the
  // funnel offers only values that narrow the list beside it: a Brew form does
  // not list Windows, and the Selected tab does not offer the customers of
  // machines it doesn't hold. Both halves in one read, so the tab switch is free.
  const filterOptions = useBundleDeviceFilters(bundleId, activeTab === 'selected' ? 'assigned' : 'available', scope);

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
      selectedCount={assignedData.softwareBundle?.deviceCount ?? 0}
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
      isDeviceDisabled={isDeviceDisabled}
    />
  );
}
