'use client';

import { LoadError } from '@flamingo-stack/openframe-frontend-core';
import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { ErrorBoundary, isManagedStatus } from '@flamingo-stack/openframe-frontend-core/components/features';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useMemo, useState } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { adoptDevicePickerQuery as AdoptDevicePickerQueryType } from '@/__generated__/adoptDevicePickerQuery.graphql';
import type { Device } from '@/app/(app)/devices/types/device.types';
import { machineSelectorToDevice } from '@/app/(app)/devices/utils/device-transform';
import { DEVICE_PICKER_TABLE_KEY, DevicePicker } from '@/app/components/shared/device-selector/device-picker';
import { NO_ITEMS } from '@/app/components/shared/no-next-page';
import { pluralize } from '@/lib/pluralize';
import { ADOPT_DEVICE_LIMIT, ADOPTABLE_DEVICES_FILTER, isAdopting } from './adoptable-devices';

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
          adoption {
            status
          }
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

/**
 * Why a row cannot be picked: the server refuses it (no agent, not managed), or its adoption is already running.
 * Offered as a disabled row rather than as a request that fails or a second order.
 */
function adoptDisabledReason(device: Device, adopting: ReadonlySet<string>): string | undefined {
  if (!device.machineId) return 'Agent is not\nconnected';
  if (!isManagedStatus(device.status)) return 'Device is not\nmanaged';
  return adopting.has(adoptDeviceKey(device)) ? 'Adoption is\nin progress' : undefined;
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
  return (
    <DevicePicker
      tableStorageKey={DEVICE_PICKER_TABLE_KEY.softwareAdopt}
      devices={NO_ITEMS}
      loading
      showSelectionModeRadio={false}
      getDeviceKey={adoptDeviceKey}
    />
  );
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
  const rows = useMemo(
    () =>
      softwareDevices.edges.map(edge => ({
        device: machineSelectorToDevice(edge.node.device),
        adopting: isAdopting(edge.node.adoption?.status),
      })),
    [softwareDevices.edges],
  );
  const devices = useMemo(() => rows.map(row => row.device), [rows]);
  const adopting = useMemo(
    () => new Set(rows.filter(row => row.adopting).map(row => adoptDeviceKey(row.device))),
    [rows],
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
      <DevicePicker
        tableStorageKey={DEVICE_PICKER_TABLE_KEY.softwareAdopt}
        devices={devices}
        loading={false}
        disabled={disabled}
        showSelectionModeRadio={false}
        getDeviceKey={adoptDeviceKey}
        selectedIds={selectedIds}
        onSelectionChange={ids => onSelectionChange(devices.filter(device => ids.has(adoptDeviceKey(device))))}
        isDeviceDisabled={device => adoptDisabledReason(device, adopting)}
      />
    </div>
  );
}
