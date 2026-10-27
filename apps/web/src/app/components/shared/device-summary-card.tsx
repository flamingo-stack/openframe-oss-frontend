'use client';

import {
  getDeviceName,
  getDeviceOperatingSystem,
  getDeviceStatusConfig,
} from '@flamingo-stack/openframe-frontend-core/components/features';
import { DeviceCard } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { DeviceDetailsButton } from '@/app/(app)/devices/components/device-details-button';
import type { PartialNamedDevice } from '@/app/(app)/devices/types/device.types';

interface DeviceSummaryCardProps {
  /** The device read so far (nothing while it is read). */
  device?: PartialNamedDevice | null;
  /** The device's id when only that is known (stands in for its id, machine id and name). */
  deviceId?: string;
  loading?: boolean;
  /** Fires when the Details button navigates this window (an overlay closes itself). */
  onNavigate?: () => void;
}

/**
 * The card of the device a log or a ticket names: the lib's `DeviceCard` with its status chip and Details button.
 * While the device is read (`loading`, or a loading scope) the card draws its own loading state.
 */
export function DeviceSummaryCard({ device, deviceId, loading, onNavigate }: DeviceSummaryCardProps) {
  const id = device?.id || deviceId || '';
  const machineId = device?.machineId || deviceId || '';
  const status = device?.status ? getDeviceStatusConfig(device.status) : undefined;
  return (
    <DeviceCard
      loading={loading}
      // The device a log or a ticket names: its tags are not listed here, so no tags row loading or loaded.
      showTags={false}
      device={{
        id,
        machineId,
        name: (device && getDeviceName(device)) || deviceId || '',
        organization: device?.organization || device?.machineId || deviceId || '',
        lastSeen: device?.lastSeen || device?.last_seen,
        operatingSystem: getDeviceOperatingSystem(device?.osType),
      }}
      statusTag={status ? { label: status.label, variant: status.variant } : undefined}
      actions={{
        moreButton: { visible: false },
        detailsButton: {
          visible: true,
          component: (
            <DeviceDetailsButton deviceId={id} machineId={machineId} className="shrink-0" onNavigate={onNavigate} />
          ),
        },
      }}
    />
  );
}
