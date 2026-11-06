'use client';

import { SOFTWARE_SOURCE_LABEL } from '@flamingo-stack/openframe-frontend-core/components/features';
import { Tag, TruncateText, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { softwareDeviceInstalledByCell_softwareOnDevice$key } from '@/__generated__/softwareDeviceInstalledByCell_softwareOnDevice.graphql';
import { ValueText } from '@/app/components/shared';
import { DeviceStatus, SoftwareAdoptionStatus, SoftwareSource } from '@/generated/schema-enums';
import { presentationFor } from '@/lib/exhaustive-map';

const softwareDeviceInstalledByCellFragment = graphql`
  fragment softwareDeviceInstalledByCell_softwareOnDevice on SoftwareOnDevice {
    installedBy
    adoption {
      status
    }
    device {
      status
    }
  }
`;

/** The word for what installed the copy: the package manager, or "Manually" for a copy installed by hand. */
function installedByLabel(source: string): string {
  if (source === SoftwareSource.UNMANAGED) return 'Manually';
  return presentationFor(SOFTWARE_SOURCE_LABEL, source) ?? source;
}

/**
 * INSTALLED BY column: the package manager that installed the copy on this device, or "Manually". While the copy is
 * being adopted (reinstalled with a package manager), or after that failed, the adoption's chip stands in its place;
 * an adoption waiting for an offline device says it starts when the device is online.
 */
export function SoftwareDeviceInstalledByCell({
  softwareOnDevice,
}: {
  softwareOnDevice: softwareDeviceInstalledByCell_softwareOnDevice$key;
}) {
  // A row still being read (a loading scope) has no fragment to read: `ValueText` draws its bar.
  const data = useFragment(softwareDeviceInstalledByCellFragment, useLoadingScope() ? null : softwareOnDevice);
  const adoption = data?.adoption?.status;

  if (adoption === SoftwareAdoptionStatus.FAILED) return <Tag label="Adoption Failed" variant="error" />;
  if (adoption === SoftwareAdoptionStatus.ADOPTING) {
    return (
      <div className="flex min-w-0 flex-col items-start justify-center">
        <Tag label="Adopting" variant="outline" />
        {data?.device.status === DeviceStatus.OFFLINE && (
          <TruncateText variant="h6" tone="secondary">
            Starts when online
          </TruncateText>
        )}
      </div>
    );
  }
  return <ValueText value={data ? (data.installedBy ? installedByLabel(data.installedBy) : null) : undefined} />;
}
