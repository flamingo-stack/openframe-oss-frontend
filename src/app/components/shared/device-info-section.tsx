'use client';

import { DeviceCard } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { DeviceDetailsButton } from '@/app/(app)/devices/components/device-details-button';
import { useDeviceDetails } from '@/app/(app)/devices/hooks/use-device-details';
import type { Device } from '@/app/(app)/devices/types/device.types';
import { getDeviceOperatingSystem, getDeviceStatusConfig } from '@/app/(app)/devices/utils/device-status';
import { DeviceInfoSectionSkeleton } from './device-info-section-skeleton';

interface DeviceInfoSectionProps {
  deviceId?: string;
  device?: Partial<Device>; // Accept device data from log or dialog
}

export function DeviceInfoSection({ deviceId, device: deviceFromProps }: DeviceInfoSectionProps) {
  const { deviceDetails, isLoading } = useDeviceDetails(deviceId && !deviceFromProps ? deviceId : null, {
    polling: false,
  });

  // Use device from props if available, otherwise use fetched deviceDetails
  const device = deviceFromProps || deviceDetails;

  // Show loading state only if we're fetching and don't have data from props
  if (isLoading && !deviceFromProps) {
    return (
      <div className="flex w-full flex-col gap-1">
        <div className="w-full text-ods-text-secondary text-h5">Device Info</div>
        <DeviceInfoSectionSkeleton />
      </div>
    );
  }

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
            name: device.displayName || device.hostname || device.description || device.machineId || deviceId || '',
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
