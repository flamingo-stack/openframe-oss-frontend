'use client';

import { DeviceCardSkeleton, LoadingRegion } from '@flamingo-stack/openframe-frontend-core/components';
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

/** The section while the device is read: the real title over the device card's own skeleton. */
function DeviceInfoSectionSkeleton() {
  return (
    <LoadingRegion label="Loading device info" className="flex w-full flex-col gap-1">
      <div className="w-full text-ods-text-secondary text-h5">Device Info</div>
      <DeviceCardSkeleton moreButton={false} detailsButtonClassName={DEVICE_DETAILS_BUTTON_BOX} />
    </LoadingRegion>
  );
}

/**
 * The device a log or ticket names, as its card. Reads the device itself when only an id is given; in a loading
 * scope it draws its own skeleton and reads nothing.
 */
export function DeviceInfoSection(props: DeviceInfoSectionProps) {
  if (useLoadingScope()) return <DeviceInfoSectionSkeleton />;
  return <LiveDeviceInfoSection {...props} />;
}

function LiveDeviceInfoSection({ deviceId, device: deviceFromProps }: DeviceInfoSectionProps) {
  const { deviceDetails, isLoading } = useDeviceDetails(deviceId && !deviceFromProps ? deviceId : null, {
    polling: false,
  });

  // Use device from props if available, otherwise use fetched deviceDetails
  const device = deviceFromProps || deviceDetails;

  // Show loading state only if we're fetching and don't have data from props
  if (isLoading && !deviceFromProps) return <DeviceInfoSectionSkeleton />;

  // If no device details available, don't show anything
  if (!device && !deviceId) {
    return null;
  }

  return (
    <div className="flex w-full flex-col gap-1">
      {/* Section Title */}
      <div className="w-full text-ods-text-secondary text-h5">Device Info</div>

      {/* Use DeviceCard component - matching devices-grid.tsx pattern */}
      {device && (
        <DeviceCard
          device={{
            id: device.id || deviceId || '',
            machineId: device.machineId || deviceId || '',
            name: getDeviceName(device) || deviceId || '',
            organization: device.organization || device.machineId || deviceId || '',
            lastSeen: device.lastSeen || device.last_seen,
            operatingSystem: getDeviceOperatingSystem(device.osType),
          }}
          statusTag={
            device.status
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
                  deviceId={device.id || deviceId || ''}
                  machineId={device.machineId || deviceId || ''}
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
