'use client';

import { LoadError } from '@flamingo-stack/openframe-frontend-core';
import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import {
  DeviceSelector,
  ErrorBoundary,
  isManagedStatus,
} from '@flamingo-stack/openframe-frontend-core/components/features';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useMemo, useState } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { adoptDevicePickerQuery as AdoptDevicePickerQueryType } from '@/__generated__/adoptDevicePickerQuery.graphql';
import type { Device } from '@/app/(app)/devices/types/device.types';
import { machineSelectorToDevice } from '@/app/(app)/devices/utils/device-transform';
import { NO_ITEMS } from '@/app/components/shared/no-next-page';
import { pluralize } from '@/lib/pluralize';
import { ADOPT_DEVICE_LIMIT, ADOPTABLE_DEVICES_FILTER } from './adoptable-devices';

/**
 * The devices the title can be adopted on, one read of as many as one adoption takes. The picker searches and filters
 * them in the browser, as Run Script's does: they are a title's hand-installed copies, not the fleet.
 */
const adoptDevicePickerQuery = graphql`
  query adoptDevicePickerQuery($softwareId: ID!, $filter: SoftwareOnDeviceFilterInput!, $first: Int!) {
    softwareDevices(softwareId: $softwareId, filter: $filter, first: $first) {
      filteredCount
      edges {
        node {
          device {
            ...deviceSelectorFields_machine
          }
        }
      }
    }
  }
`;

/** `adoptSoftware` takes Machine global ids: the selection is keyed by them. */
export const adoptDeviceKey = (device: Device) => device.id;

/** Refused by the server, so offered as a disabled row rather than as a request that fails. */
function adoptDisabledReason(device: Device): string | undefined {
  if (!device.machineId) return 'Agent is not\nconnected';
  return isManagedStatus(device.status) ? undefined : 'Device is not\nmanaged';
}

interface AdoptDevicePickerProps {
  softwareId: string;
  selected: Device[];
  onSelectionChange: (devices: Device[]) => void;
  disabled?: boolean;
}

/**
 * "Device Selection" of the Adopt page (design 1227:569): Available / Selected Devices, search, Device Tags and the
 * Customer funnel, over the devices where no package manager manages the title. Its own boundaries: the page around it
 * holds the selection, which a failed read must not discard. In a loading scope it draws the picker loading.
 */
export function AdoptDevicePicker(props: AdoptDevicePickerProps) {
  const [retryNonce, setRetryNonce] = useState(0);
  if (useLoadingScope()) return <LoadingAdoptDevicePicker />;
  return (
    <ErrorBoundary
      key={retryNonce}
      fallback={<LoadError message="Couldn't load devices." onRetry={() => setRetryNonce(nonce => nonce + 1)} />}
    >
      <AdoptDevicePickerBoundary {...props} retryKey={retryNonce} />
    </ErrorBoundary>
  );
}

/** The picker's read, with its own boundary: in its scope the reader draws the picker loading. */
function AdoptDevicePickerBoundary(props: AdoptDevicePickerProps & { retryKey: number }) {
  return (
    <LoadingSuspense label="Loading devices" className="contents">
      <AdoptDevicePickerReader {...props} />
    </LoadingSuspense>
  );
}

function LoadingAdoptDevicePicker() {
  return <DeviceSelector devices={NO_ITEMS} loading showSelectionModeRadio={false} getDeviceKey={adoptDeviceKey} />;
}

function AdoptDevicePickerReader(props: AdoptDevicePickerProps & { retryKey: number }) {
  if (useLoadingScope()) return <LoadingAdoptDevicePicker />;
  return <AdoptDevicePickerQuery {...props} />;
}

function AdoptDevicePickerQuery({
  softwareId,
  selected,
  onSelectionChange,
  disabled,
  retryKey,
}: AdoptDevicePickerProps & { retryKey: number }) {
  const { softwareDevices } = useLazyLoadQuery<AdoptDevicePickerQueryType>(
    adoptDevicePickerQuery,
    { softwareId, filter: ADOPTABLE_DEVICES_FILTER, first: ADOPT_DEVICE_LIMIT },
    // Refreshed on every visit; after an adoption the store is stale (`useAdoptSoftware`), so the list is never
    // drawn from before it.
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );
  const devices = useMemo(
    () => softwareDevices.edges.map(edge => machineSelectorToDevice(edge.node.device)),
    [softwareDevices.edges],
  );
  const selectedIds = useMemo(() => new Set(selected.map(adoptDeviceKey)), [selected]);
  const more = softwareDevices.filteredCount - devices.length;

  return (
    <div className="flex flex-col gap-[var(--spacing-system-m)]">
      {more > 0 && (
        <p className="text-ods-text-secondary text-h6">
          {`Showing the first ${pluralize(devices.length, 'device')} of ${softwareDevices.filteredCount}: one adoption takes up to ${ADOPT_DEVICE_LIMIT}. Adopt these, and the rest are listed here next.`}
        </p>
      )}
      <DeviceSelector
        devices={devices}
        loading={false}
        disabled={disabled}
        showSelectionModeRadio={false}
        getDeviceKey={adoptDeviceKey}
        selectedIds={selectedIds}
        onSelectionChange={ids => onSelectionChange(devices.filter(device => ids.has(adoptDeviceKey(device))))}
        isDeviceDisabled={adoptDisabledReason}
      />
    </div>
  );
}
