'use client';

import { formatLastOnline, getDeviceStatusConfig } from '@flamingo-stack/openframe-frontend-core/components/features';
import { Tag, TruncateText, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { softwareLogDeviceCell_device$key } from '@/__generated__/softwareLogDeviceCell_device.graphql';
import { ValueText } from '@/app/components/shared';

const softwareLogDeviceCellFragment = graphql`
  fragment softwareLogDeviceCell_device on SoftwareActionDevice {
    machineId
    hostname
    deviceStatus
    lastSeen
  }
`;

/** DEVICE column: the device with its status chip, and when it was last online. */
export function SoftwareLogDeviceCell({ device }: { device: softwareLogDeviceCell_device$key | null | undefined }) {
  // A row still being read (a loading scope) has no fragment to read: the name and the last-online line draw their
  // bars.
  const loading = useLoadingScope();
  const data = useFragment(softwareLogDeviceCellFragment, loading ? null : device);
  const status = data?.deviceStatus ? getDeviceStatusConfig(data.deviceStatus) : null;

  return (
    <div className="flex min-w-0 flex-1 flex-col justify-center">
      <div className="flex min-w-0 items-center gap-[var(--spacing-system-xxs)]">
        <div className="min-w-0">
          {/* The run knows the device by its hostname; one that never reported a name reads as its id. */}
          <ValueText value={data ? data.hostname || data.machineId : undefined} />
        </div>
        {status && <Tag label={status.label} variant={status.variant} />}
      </div>
      <TruncateText variant="h6" tone="secondary" loading={loading}>
        {formatLastOnline(data?.lastSeen)}
      </TruncateText>
    </div>
  );
}
