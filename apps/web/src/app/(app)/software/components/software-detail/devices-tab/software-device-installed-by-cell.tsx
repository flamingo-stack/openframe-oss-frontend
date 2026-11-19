'use client';

import { SOFTWARE_SOURCE_LABEL } from '@flamingo-stack/openframe-frontend-core/components/features';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { softwareDeviceInstalledByCell_softwareOnDevice$key } from '@/__generated__/softwareDeviceInstalledByCell_softwareOnDevice.graphql';
import { ValueText } from '@/app/components/shared';
import { presentationFor } from '@/lib/exhaustive-map';
import { useSoftwareAdoptGate } from '../../adopt/use-software-adopt-gate';
import { SoftwareDeviceAdoptionTag } from './software-device-adoption-tag';

const softwareDeviceInstalledByCellFragment = graphql`
  fragment softwareDeviceInstalledByCell_softwareOnDevice on SoftwareOnDevice {
    installedBy
    adoption {
      __typename
    }
    ...softwareDeviceAdoptionTag_softwareOnDevice
  }
`;

/**
 * MANAGED BY column (design 1100:444): the package manager that installed the copy on this device, Unmanaged for one
 * installed by hand; the empty mark when it is not known. The design's "Manageable" (installed by hand, can be adopted)
 * is not drawn: whether a copy can be adopted is known per title (`Software.adoptionPackage`), not per device.
 *
 * While an adoption runs, or after it failed, its chip takes the installer's place (design 1227:45730), when Adopt is on.
 */
export function SoftwareDeviceInstalledByCell({
  softwareOnDevice,
}: {
  softwareOnDevice: softwareDeviceInstalledByCell_softwareOnDevice$key;
}) {
  const adoptOn = useSoftwareAdoptGate() === 'on';
  // A row still being read (a loading scope) has no fragment to read: `ValueText` draws its bar.
  const data = useFragment(softwareDeviceInstalledByCellFragment, useLoadingScope() ? null : softwareOnDevice);
  // Without Adopt the column is the installer, as it was before it.
  if (adoptOn && data?.adoption) return <SoftwareDeviceAdoptionTag softwareOnDevice={data} />;

  const source = data?.installedBy;
  return (
    <ValueText
      value={data ? (source ? (presentationFor(SOFTWARE_SOURCE_LABEL, source) ?? source) : null) : undefined}
    />
  );
}
