'use client';

import { LoadError } from '@flamingo-stack/openframe-frontend-core';
import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import {
  type DeviceFilterInput,
  DeviceSelector,
  type DeviceSelectorProps,
  ErrorBoundary,
} from '@flamingo-stack/openframe-frontend-core/components/features';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useCallback, useMemo, useState } from 'react';
import { DEVICE_LIST_LIMIT, useDeviceList } from '@/app/(app)/devices/hooks/use-device-list';
import type { Device } from '@/app/(app)/devices/types/device.types';
import { NO_ITEMS } from '../no-next-page';

export type DeviceListPickerProps = Omit<
  DeviceSelectorProps<Device>,
  'devices' | 'loading' | 'selectedIds' | 'onSelectionChange' | 'getDeviceKey'
> & {
  filter?: DeviceFilterInput;
  search?: string;
  /** Result cap. Defaults to the shared device-list limit. */
  first?: number;
  /** Bumped by the retry action; changes the query's cache key so it refetches. */
  retryKey?: number;
  /** Extract the selection key. Used for both the selector and the id set built here. */
  getDeviceKey: (device: Device) => string;
  /**
   * Selection as DEVICES, not ids.
   *
   * The device list lives inside this component (its query suspends), so a
   * parent holding only ids would have nothing to resolve them against when it
   * submits. Handing back the devices themselves is what lets the parent stay
   * outside the Suspense boundary.
   */
  selected: Device[];
  onSelectionChange: (devices: Device[]) => void;
};

function DeviceListPickerContent({
  filter,
  search,
  first,
  retryKey,
  selected,
  onSelectionChange,
  getDeviceKey,
  ...selectorProps
}: DeviceListPickerProps) {
  const { devices } = useDeviceList({ filter, search, first, retryKey });

  const selectedIds = useMemo(() => new Set(selected.map(getDeviceKey)), [selected, getDeviceKey]);

  const handleSelectionChange = useCallback(
    (ids: Set<string>) => onSelectionChange(devices.filter(d => ids.has(getDeviceKey(d)))),
    [devices, getDeviceKey, onSelectionChange],
  );

  return (
    <DeviceSelector
      {...selectorProps}
      devices={devices}
      // The query has resolved by the time this renders — the boundaries below
      // own the loading state now.
      loading={false}
      getDeviceKey={getDeviceKey}
      selectedIds={selectedIds}
      onSelectionChange={handleSelectionChange}
    />
  );
}

/** The picker while its one read of `first` devices is on its way: the real selector, loading. */
function LoadingDeviceListPicker({
  filter: _filter,
  search: _search,
  first = DEVICE_LIST_LIMIT,
  retryKey: _retryKey,
  selected: _selected,
  onSelectionChange: _onSelectionChange,
  getDeviceKey,
  ...selectorProps
}: DeviceListPickerProps) {
  return (
    <DeviceSelector {...selectorProps} devices={NO_ITEMS} loading skeletonRows={first} getDeviceKey={getDeviceKey} />
  );
}

/**
 * A `DeviceSelector` that fetches its own devices through the shared device
 * query layer.
 *
 * Owns its Suspense and error boundaries so the five pickers using it don't each
 * re-derive a fallback that can drift from the selector it replaces. Callers
 * still control WHETHER it mounts — a Relay query runs because its component is
 * rendered, which is what the old `enabled` flag expressed, so gate with
 * `{isOpen && <DeviceListPicker … />}`. In a loading scope it draws its own
 * loading state and runs nothing.
 */
export function DeviceListPicker(props: DeviceListPickerProps) {
  const [retryNonce, setRetryNonce] = useState(0);
  // In a loading scope (a parent's Suspense fallback) the picker draws its own loading state and mounts no query:
  // nothing in a scope fetches.
  const inScope = useLoadingScope();
  const loadingPicker = <LoadingDeviceListPicker {...props} />;

  if (inScope) return loadingPicker;

  return (
    // The Relay hook THROWS on failure, and every caller here holds unsaved work
    // — a run config, an open selection. Without a boundary that throw reaches
    // the route-level `error.tsx` and discards it.
    //
    // The `key` clears the boundary's caught state; `retryKey` (threaded into the
    // query's fetch key) is what actually refetches. Remounting alone would find
    // Relay's cached Error under the unchanged cache identifier and re-throw it.
    <ErrorBoundary
      key={retryNonce}
      fallback={<LoadError message="Couldn't load devices." onRetry={() => setRetryNonce(nonce => nonce + 1)} />}
    >
      <LoadingSuspense label="Loading devices" className="contents" fallback={loadingPicker}>
        <DeviceListPickerContent {...props} retryKey={retryNonce} />
      </LoadingSuspense>
    </ErrorBoundary>
  );
}
