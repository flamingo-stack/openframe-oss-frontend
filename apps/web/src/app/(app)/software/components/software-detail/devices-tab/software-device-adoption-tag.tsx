'use client';

import { DotsLoaderIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { FloatingTooltip, Tag } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { graphql, useFragment } from 'react-relay';
import type { softwareDeviceAdoptionTag_softwareOnDevice$key } from '@/__generated__/softwareDeviceAdoptionTag_softwareOnDevice.graphql';
import { DeviceConnectivity, SoftwareAdoptionStatus } from '@/generated/schema-enums';
import { useSoftwareAdoptGate } from '../../adopt/use-software-adopt-gate';

const softwareDeviceAdoptionTagFragment = graphql`
  fragment softwareDeviceAdoptionTag_softwareOnDevice on SoftwareOnDevice {
    adoption {
      status
      error
    }
    device {
      connectivity
    }
  }
`;

/**
 * The device's adoption of the title (design 1227:45730): ADOPTING, with "Starts when online" under it on an offline
 * device, or ADOPTION FAILED with the device's reason on hover. Nothing when there is no adoption, while the row is
 * read (null), or while Adopt is not on (`useSoftwareAdoptGate`).
 */
export function SoftwareDeviceAdoptionTag({
  softwareOnDevice,
  className,
}: {
  softwareOnDevice: softwareDeviceAdoptionTag_softwareOnDevice$key | null;
  /** Where it is drawn: the host's visibility for it, e.g. only while its own column is hidden. */
  className?: string;
}) {
  const adoptOn = useSoftwareAdoptGate() === 'on';
  const data = useFragment(softwareDeviceAdoptionTagFragment, softwareOnDevice);
  const adoption = adoptOn ? data?.adoption : null;

  if (adoption?.status === SoftwareAdoptionStatus.ADOPTING) {
    const offline = data?.device.connectivity === DeviceConnectivity.OFFLINE;
    return (
      <div className={cn('flex min-w-0 flex-col items-start gap-[var(--spacing-system-xxs)]', className)}>
        <Tag label="Adopting" variant="warning" icon={<DotsLoaderIcon className="h-4 w-4" />} />
        {offline && <p className="truncate text-ods-text-secondary text-h6">Starts when online</p>}
      </div>
    );
  }
  if (adoption?.status === SoftwareAdoptionStatus.FAILED) {
    return (
      <div className={cn('flex min-w-0', className)}>
        <FloatingTooltip content={adoption.error} disabled={!adoption.error} as="span">
          <Tag label="Adoption failed" variant="error" />
        </FloatingTooltip>
      </div>
    );
  }
  return null;
}
