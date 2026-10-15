'use client';

import { DeviceCardSkeleton, LoadingRegion } from '@flamingo-stack/openframe-frontend-core/components';
import {
  getDeviceName,
  getDeviceOperatingSystem,
  getDeviceStatusConfig,
} from '@flamingo-stack/openframe-frontend-core/components/features';
import { DeviceCard } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { ReactNode } from 'react';
import { DEVICE_DETAILS_BUTTON_BOX, DeviceDetailsButton } from '@/app/(app)/devices/components/device-details-button';
import { useDeviceDetails } from '@/app/(app)/devices/hooks/use-device-details';

function LogDrawerDeviceCard({ deviceId, onNavigate }: { deviceId: string; onNavigate: () => void }) {
  const { deviceDetails, isLoading } = useDeviceDetails(deviceId, { polling: false });

  if (isLoading) {
    return (
      <LoadingRegion label="Loading device">
        <DeviceCardSkeleton moreButton={false} detailsButtonClassName={DEVICE_DETAILS_BUTTON_BOX} />
      </LoadingRegion>
    );
  }

  if (!deviceDetails) return null;

  return (
    <DeviceCard
      device={{
        id: deviceDetails.id,
        machineId: deviceDetails.machineId,
        name: getDeviceName(deviceDetails),
        organization: deviceDetails.organization || deviceDetails.machineId,
        lastSeen: deviceDetails.lastSeen,
        operatingSystem: getDeviceOperatingSystem(deviceDetails.osType),
      }}
      statusTag={
        deviceDetails.status
          ? {
              label: getDeviceStatusConfig(deviceDetails.status).label,
              variant: getDeviceStatusConfig(deviceDetails.status).variant,
            }
          : undefined
      }
      actions={{
        moreButton: { visible: false },
        detailsButton: {
          visible: true,
          component: (
            <DeviceDetailsButton
              deviceId={deviceDetails.id}
              machineId={deviceDetails.machineId}
              className="shrink-0"
              onNavigate={onNavigate}
            />
          ),
        },
      }}
    />
  );
}

/**
 * The `deviceCard` of the lib's `LogDrawer` for a log's device: the card the
 * drawer pins to its bottom, or nothing for a log with no device (system events
 * carry the literal "null").
 *
 * `onNavigate` is the drawer's close: the card's Details button targets a
 * `?id=` detail URL, so on the device page itself the click changes nothing on
 * screen and reads as broken unless the drawer gets out of the way.
 */
export function logDrawerDeviceCard(deviceId: string | undefined, onNavigate: () => void): ReactNode {
  if (!deviceId || deviceId === 'null') return undefined;
  return <LogDrawerDeviceCard deviceId={deviceId} onNavigate={onNavigate} />;
}
