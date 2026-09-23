'use client';

import { useDebounce } from '@flamingo-stack/openframe-frontend-core/hooks';
import { Suspense, useCallback, useMemo, useState } from 'react';
import type { Device, DeviceFilterInput } from '@/app/(app)/devices/types/device.types';
import { ContentErrorBoundary } from '@/app/components/shared';
import type { DeviceSelectorNarrowing, SubTab } from '@/app/components/shared/device-selector/device-selector.types';
import { EMPTY_NARROWING, narrowingToFilter } from '@/app/components/shared/device-selector/picker-narrowing';
import { ServerDevicePickerSkeleton } from '@/app/components/shared/device-selector/server-device-picker-lists';
import { useDeferredQuery } from '@/app/hooks/use-deferred-query';
import { BundlePickerLists } from './bundle-picker-lists';
import { FleetPickerLists } from './fleet-picker-lists';
import { useBundleDeviceAssignment } from './use-bundle-device-assignment';

interface BundleDevicePickerProps {
  /** The draft, once the first device has been assigned. */
  bundleId: string | null;
  ensureBundle: () => Promise<string>;
  /** The form's own scope — the OS the chosen packages install on, and live devices only. */
  scope: DeviceFilterInput;
  isDeviceDisabled?: (device: Device) => string | undefined;
}

/**
 * The user's funnels and chips, within the form's scope. A dimension the user
 * has not touched reads the scope's value; one they have reads theirs — the
 * facets are resolved within the scope, so what they can pick is a subset of it.
 */
function narrowWithinScope(scope: DeviceFilterInput, narrowing: DeviceFilterInput): DeviceFilterInput {
  return {
    ...narrowing,
    statuses: narrowing.statuses?.length ? narrowing.statuses : scope.statuses,
    osTypes: narrowing.osTypes?.length ? narrowing.osTypes : scope.osTypes,
  };
}

/**
 * "Device Selection" on the Install / Update Software form: the picker's state
 * — tab, search, funnels — and every write it performs. Each +/− commits as it
 * is clicked, so there is nothing to collect for submit; the bundle IS the
 * selection.
 *
 * Two lists back it in turn. Until the first device is assigned there is no
 * bundle, and the fleet answers the Available tab; the first "+" creates the
 * draft and the bundle's own lists take over, under this same state, so the
 * search and the funnels survive the swap.
 *
 * Its own boundary, because the form around it holds unsaved work: a query
 * that fails must not reach the route's `error.tsx` and discard the packages
 * the user has already picked.
 */
export function BundleDevicePicker({ bundleId, ensureBundle, scope, isDeviceDisabled }: BundleDevicePickerProps) {
  const [activeTab, setActiveTab] = useState<SubTab>('available');
  const [search, setSearch] = useState('');
  const [narrowing, setNarrowing] = useState<DeviceSelectorNarrowing>(EMPTY_NARROWING);

  const debouncedSearch = useDebounce(search, 300);
  const filter = useMemo(() => narrowWithinScope(scope, narrowingToFilter(narrowing)), [scope, narrowing]);
  const { deferredFilters: deferredFilter, deferredSearch } = useDeferredQuery(filter, debouncedSearch);

  const { busy, addDevice, removeDevice, addAllDevices, removeAllDevices } = useBundleDeviceAssignment({
    bundleId,
    ensureBundle,
    filter,
    search: debouncedSearch,
    deferredFilter,
    deferredSearch,
  });

  // Each tab narrows its own list, and carrying one tab's search into the other
  // would silently hide rows the user never filtered.
  const handleTabChange = useCallback((tab: SubTab) => {
    setActiveTab(tab);
    setSearch('');
    setNarrowing(EMPTY_NARROWING);
  }, []);

  const lists = {
    activeTab,
    onTabChange: handleTabChange,
    search,
    onSearchChange: setSearch,
    narrowing,
    onNarrowingChange: setNarrowing,
    deferredFilter,
    deferredSearch,
    busy,
    onAdd: addDevice,
    onRemove: removeDevice,
    onAddAll: addAllDevices,
    onRemoveAll: removeAllDevices,
    isDeviceDisabled,
  };

  return (
    <ContentErrorBoundary label="software-bundle-picker" message="Couldn't load devices.">
      <Suspense fallback={<ServerDevicePickerSkeleton />}>
        {bundleId ? (
          <BundlePickerLists bundleId={bundleId} scope={scope} {...lists} />
        ) : (
          <FleetPickerLists scope={scope} {...lists} />
        )}
      </Suspense>
    </ContentErrorBoundary>
  );
}
