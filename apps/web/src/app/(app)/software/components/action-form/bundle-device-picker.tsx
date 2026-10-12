'use client';

import {
  type DeviceFilterInput,
  type DeviceSelectorNarrowing,
  EMPTY_NARROWING,
  narrowingToFilter,
  type SubTab,
} from '@flamingo-stack/openframe-frontend-core/components/features';
import { useDebounce } from '@flamingo-stack/openframe-frontend-core/hooks';
import { Suspense, useCallback, useMemo, useState } from 'react';
import type { Device } from '@/app/(app)/devices/types/device.types';
import { ContentErrorBoundary } from '@/app/components/shared';
import { ServerDevicePickerSkeleton } from '@/app/components/shared/device-selector/server-device-picker-lists';
import { useDeferredQuery } from '@/app/hooks/use-deferred-query';
import { BundlePickerLists } from './bundle-picker-lists';
import { useBundleDeviceAssignment } from './use-bundle-device-assignment';

interface BundleDevicePickerProps {
  /** The draft — null while it is being opened (`useDraftBundle`). */
  bundleId: string | null;
  /** Opening the draft failed; shown with the boundary's Retry, which calls `onRetryCreate`. */
  createError: Error | null;
  onRetryCreate: () => void;
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

/** Hands a failed draft creation to the boundary, so it gets the same error card and Retry as a failed query. */
function ThrowError({ error }: { error: Error }): never {
  throw error;
}

/**
 * "Device Selection" on the Install / Update Software form. Its own boundary,
 * because the form around it holds unsaved work: a query that fails must not
 * reach the route's `error.tsx` and discard the packages the user has already
 * picked. The picker proper waits for the draft — the skeleton stands in until
 * the form has one — so there is a single set of lists, the bundle's, from the
 * first click on.
 */
export function BundleDevicePicker({
  bundleId,
  createError,
  onRetryCreate,
  scope,
  isDeviceDisabled,
}: BundleDevicePickerProps) {
  return (
    <ContentErrorBoundary label="software-bundle-picker" message="Couldn't load devices." onRetry={onRetryCreate}>
      <Suspense fallback={<ServerDevicePickerSkeleton />}>
        {createError ? (
          <ThrowError error={createError} />
        ) : bundleId ? (
          <BundleDevicePickerLists bundleId={bundleId} scope={scope} isDeviceDisabled={isDeviceDisabled} />
        ) : (
          <ServerDevicePickerSkeleton />
        )}
      </Suspense>
    </ContentErrorBoundary>
  );
}

/**
 * The picker's state — tab, search, funnels — and every write it performs. Each
 * +/− commits as it is clicked, so there is nothing to collect for submit; the
 * bundle IS the selection.
 */
function BundleDevicePickerLists({
  bundleId,
  scope,
  isDeviceDisabled,
}: Omit<BundleDevicePickerProps, 'bundleId' | 'createError' | 'onRetryCreate'> & { bundleId: string }) {
  const [activeTab, setActiveTab] = useState<SubTab>('available');
  const [search, setSearch] = useState('');
  const [narrowing, setNarrowing] = useState<DeviceSelectorNarrowing>(EMPTY_NARROWING);

  const debouncedSearch = useDebounce(search, 300);
  const filter = useMemo(() => narrowWithinScope(scope, narrowingToFilter(narrowing)), [scope, narrowing]);
  const { deferredFilters: deferredFilter, deferredSearch } = useDeferredQuery(filter, debouncedSearch);

  const { busy, addDevice, removeDevice, addAllDevices, removeAllDevices } = useBundleDeviceAssignment({
    bundleId,
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

  return <BundlePickerLists bundleId={bundleId} scope={scope} {...lists} />;
}
