'use client';

import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useDeviceDetails } from '@/app/(app)/devices/hooks/use-device-details';
import type { PartialNamedDevice } from '@/app/(app)/devices/types/device.types';
import { DeviceSummaryCard } from './device-summary-card';

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
      <div className="w-full text-ods-text-secondary text-h5">Device Info</div>
      {(loading || device) && <DeviceSummaryCard device={device} deviceId={deviceId} loading={loading} />}
    </div>
  );
}
