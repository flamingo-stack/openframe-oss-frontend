'use client';

import {
  DeviceConnectivityIcon,
  DeviceLifecycleTag,
  formatLastOnline,
} from '@flamingo-stack/openframe-frontend-core/components/features';
import { TruncateText, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { softwareLogDeviceCell_device$key } from '@/__generated__/softwareLogDeviceCell_device.graphql';
import { ValueText } from '@/app/components/shared';

const softwareLogDeviceCellFragment = graphql`
  fragment softwareLogDeviceCell_device on SoftwareActionDevice {
    machineId
    hostname
    deviceStatus
    connectivity
    lastSeen
  }
`;

/** DEVICE column: whether the device is online, the device with its status chip, and when it was last online. */
export function SoftwareLogDeviceCell({ device }: { device: softwareLogDeviceCell_device$key | null | undefined }) {
  // A row still being read (a loading scope) has no fragment to read: the name and the last-online line draw their
  // bars.
  const loading = useLoadingScope();
  const data = useFragment(softwareLogDeviceCellFragment, loading ? null : device);

  return (
    <div className="flex min-w-0 items-center gap-[var(--spacing-system-mf)]">
      {/* Whether the device is online right now (Figma 3324-6819); its lifecycle is the tag beside the name
          from tablet width up (the phone frame 1059:18100 draws none, so the name keeps the row). The run
          does not know the device's type, so the legacy display draws no icon here. */}
      <DeviceConnectivityIcon connectivity={data?.connectivity} lastSeen={data?.lastSeen} />
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <div className="flex min-w-0 items-center gap-[var(--spacing-system-xxs)]">
          <div className="min-w-0">
            {/* The run knows the device by its hostname; one that never reported a name reads as its id. */}
            <ValueText value={data ? data.hostname || data.machineId : undefined} />
          </div>
          {data?.deviceStatus && (
            <DeviceLifecycleTag
              status={data.deviceStatus}
              connectivity={data.connectivity}
              className="hidden shrink-0 content-md:inline-flex"
              data-loading-optional
            />
          )}
        </div>
        <TruncateText variant="h6" tone="secondary" loading={loading}>
          {formatLastOnline(data?.lastSeen)}
        </TruncateText>
      </div>
    </div>
  );
}
