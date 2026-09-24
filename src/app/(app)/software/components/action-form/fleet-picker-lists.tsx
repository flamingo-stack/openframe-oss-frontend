'use client';

import { graphql, useLazyLoadQuery, usePaginationFragment } from 'react-relay';
import type {
  fleetPickerLists_devices$data as FleetFragmentData,
  fleetPickerLists_devices$key as FleetFragmentKey,
} from '@/__generated__/fleetPickerLists_devices.graphql';
import type { fleetPickerListsPaginationQuery as FleetPaginationQueryType } from '@/__generated__/fleetPickerListsPaginationQuery.graphql';
import type { fleetPickerListsQuery as FleetQueryType } from '@/__generated__/fleetPickerListsQuery.graphql';
import { useDeviceFilters } from '@/app/(app)/devices/hooks/use-device-filters';
import type { Device, DeviceFilterInput } from '@/app/(app)/devices/types/device.types';
import { useRetryKey } from '@/app/components/shared';
import type { DeviceSelectorNarrowing, SubTab } from '@/app/components/shared/device-selector/device-selector.types';
import { DEVICE_PICKER_PAGE_SIZE } from '@/app/components/shared/device-selector/picker-narrowing';
import {
  type PickerHalf,
  ServerDevicePickerLists,
} from '@/app/components/shared/device-selector/server-device-picker-lists';
import { toRelayDeviceFilter } from '@/graphql/devices/to-relay-device-filter';

/**
 * The fleet, before there is a bundle to ask. Nothing is assigned yet, so the
 * root `devices` connection answers the Available tab exactly, with no
 * `assigned` flag to read.
 */
const fleetPickerListsQuery = graphql`
  query fleetPickerListsQuery($filter: DeviceFilterInput, $search: String, $first: Int!, $after: String) {
    ...fleetPickerLists_devices @arguments(filter: $filter, search: $search, first: $first, after: $after)
  }
`;

const devicesFragment = graphql`
  fragment fleetPickerLists_devices on Query
  @refetchable(queryName: "fleetPickerListsPaginationQuery")
  @argumentDefinitions(
    filter: { type: "DeviceFilterInput" }
    search: { type: "String" }
    first: { type: "Int", defaultValue: 20 }
    after: { type: "String" }
  ) {
    devices(filter: $filter, search: $search, first: $first, after: $after)
      @connection(key: "fleetPickerLists_devices") {
      filteredCount
      edges {
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

/** The Selected tab with no bundle behind it: empty, and nothing to page. */
const NOTHING_SELECTED: PickerHalf = {
  connection: { filteredCount: 0, edges: [] },
  hasNext: false,
  isLoadingNext: false,
  loadNext: () => undefined,
};

interface FleetPickerListsProps {
  /** The form's own scope — the OS the chosen packages install on, and live devices only. */
  scope: DeviceFilterInput;
  activeTab: SubTab;
  onTabChange: (tab: SubTab) => void;
  search: string;
  onSearchChange: (value: string) => void;
  narrowing: DeviceSelectorNarrowing;
  onNarrowingChange: (next: DeviceSelectorNarrowing) => void;
  /** Deferred narrowing — what the list is actually reading. */
  deferredFilter: DeviceFilterInput;
  deferredSearch: string;
  busy: boolean;
  onAdd: (device: Device) => void;
  onRemove: (device: Device) => void;
  onAddAll: () => void;
  onRemoveAll: () => void;
  isDeviceDisabled?: (device: Device) => string | undefined;
}

/**
 * The device picker until the first device is assigned — the same picker over
 * the fleet instead of over a bundle. The first "+" creates the draft, and the
 * page swaps this for `BundlePickerLists`, whose rows carry the assignment.
 * Suspends — the picker renders it under its own boundary.
 */
export function FleetPickerLists({
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
}: FleetPickerListsProps) {
  const retryKey = useRetryKey();
  const data = useLazyLoadQuery<FleetQueryType>(
    fleetPickerListsQuery,
    {
      filter: toRelayDeviceFilter(deferredFilter),
      search: deferredSearch || null,
      first: DEVICE_PICKER_PAGE_SIZE,
      after: null,
    },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );
  const fleet = usePaginationFragment<FleetPaginationQueryType, FleetFragmentKey>(devicesFragment, data);

  // The fleet's own facets, within the form's scope — the same frame the bundle
  // picker's scoped facets describe once there is a bundle.
  const filterOptions = useDeviceFilters(scope);

  return (
    <ServerDevicePickerLists
      available={{
        connection: (fleet.data as FleetFragmentData).devices,
        hasNext: fleet.hasNext,
        isLoadingNext: fleet.isLoadingNext,
        loadNext: fleet.loadNext,
      }}
      selected={NOTHING_SELECTED}
      selectedCount={0}
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
