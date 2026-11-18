'use client';

import { SOFTWARE_SOURCE_LABEL } from '@flamingo-stack/openframe-frontend-core/components/features';
import { DotsLoaderIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { FloatingTooltip, Tag, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { softwareDeviceInstalledByCell_softwareOnDevice$key } from '@/__generated__/softwareDeviceInstalledByCell_softwareOnDevice.graphql';
import { ValueText } from '@/app/components/shared';
import { DeviceConnectivity, SoftwareAdoptionStatus } from '@/generated/schema-enums';
import { presentationFor } from '@/lib/exhaustive-map';

const softwareDeviceInstalledByCellFragment = graphql`
  fragment softwareDeviceInstalledByCell_softwareOnDevice on SoftwareOnDevice {
    installedBy
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
 * MANAGED BY column (design 1100:444): the package manager that installed the copy on this device, Unmanaged for one
 * installed by hand; the empty mark when it is not known. The design's "Manageable" (installed by hand, can be adopted)
 * is not drawn: whether a copy can be adopted is known per title (`Software.adoptionPackage`), not per device.
 *
 * While an adoption runs, or after it failed, its chip takes the installer's place (design 1227:45730): ADOPTING, with
 * "Starts when online" under it on an offline device, and ADOPTION FAILED with the device's reason on hover.
 */
export function SoftwareDeviceInstalledByCell({
  softwareOnDevice,
}: {
  softwareOnDevice: softwareDeviceInstalledByCell_softwareOnDevice$key;
}) {
  // A row still being read (a loading scope) has no fragment to read: `ValueText` draws its bar.
  const data = useFragment(softwareDeviceInstalledByCellFragment, useLoadingScope() ? null : softwareOnDevice);

  if (data?.adoption?.status === SoftwareAdoptionStatus.ADOPTING) {
    const offline = data.device.connectivity === DeviceConnectivity.OFFLINE;
    return (
      <div className="flex min-w-0 flex-col items-start gap-[var(--spacing-system-xxs)]">
        <Tag label="Adopting" variant="warning" icon={<DotsLoaderIcon className="h-4 w-4" />} />
        {offline && <p className="truncate text-ods-text-secondary text-h6">Starts when online</p>}
      </div>
    );
  }
  if (data?.adoption?.status === SoftwareAdoptionStatus.FAILED) {
    return (
      <FloatingTooltip content={data.adoption.error} disabled={!data.adoption.error} as="span">
        <Tag label="Adoption failed" variant="error" />
      </FloatingTooltip>
    );
  }

  const source = data?.installedBy;
  return (
    <ValueText
      value={data ? (source ? (presentationFor(SOFTWARE_SOURCE_LABEL, source) ?? source) : null) : undefined}
    />
  );
}
