'use client';

import {
  getDeviceName,
  getDeviceOperatingSystem,
  getDeviceStatusConfig,
} from '@flamingo-stack/openframe-frontend-core/components/features';
import { DeviceCard, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { DEVICE_DETAILS_BUTTON_BOX, DeviceDetailsButton } from '@/app/(app)/devices/components/device-details-button';
import { useDeviceDetails } from '@/app/(app)/devices/hooks/use-device-details';
import type { PartialNamedDevice } from '@/app/(app)/devices/types/device.types';

interface DeviceInfoSectionProps {
  deviceId?: string;
  device?: PartialNamedDevice; // Accept device data from log or dialog
}

/**
 * The device a log or ticket names, as its card. Reads the device itself when only an id is given; while it is read
 * (or in a loading scope, where it reads nothing) the card draws its own loading state under the real title.
 */
export function DeviceInfoSection({ deviceId, device: deviceFromProps }: DeviceInfoSectionProps) {
  const inScope = useLoadingScope();
  const { deviceDetails, isLoading } = useDeviceDetails(!inScope && deviceId && !deviceFromProps ? deviceId : null, {
    polling: false,
  });

  // Use device from props if available, otherwise use fetched deviceDetails
  const device = deviceFromProps || deviceDetails;
  // Loading only while we fetch and have no data from props.
  const loading = inScope || (isLoading && !deviceFromProps);

  // If no device details available, don't show anything
  if (!loading && !device && !deviceId) {
    return null;
  }

  return (
    <div className="flex w-full flex-col gap-1">
      {/* Section Title */}
      <div className="w-full text-ods-text-secondary text-h5">Device Info</div>

      {/* Use DeviceCard component - matching devices-grid.tsx pattern */}
      {(loading || device) && (
        <DeviceCard
          detailsButtonSkeletonClassName={DEVICE_DETAILS_BUTTON_BOX}
          loading={loading}
          device={{
            id: device?.id || deviceId || '',
            machineId: device?.machineId || deviceId || '',
            name: (device && getDeviceName(device)) || deviceId || '',
            organization: device?.organization || device?.machineId || deviceId || '',
            lastSeen: device?.lastSeen || device?.last_seen,
            operatingSystem: getDeviceOperatingSystem(device?.osType),
          }}
          statusTag={
            device?.status
              ? {
                  label: getDeviceStatusConfig(device.status).label,
                  variant: getDeviceStatusConfig(device.status).variant,
                }
              : undefined
          }
          actions={{
            moreButton: {
              visible: false,
            },
            detailsButton: {
              visible: true,
              component: (
                <DeviceDetailsButton
                  deviceId={device?.id || deviceId || ''}
                  machineId={device?.machineId || deviceId || ''}
                  className="shrink-0"
                />
              ),
            },
          }}
        />
      )}
    </div>
  );
}
