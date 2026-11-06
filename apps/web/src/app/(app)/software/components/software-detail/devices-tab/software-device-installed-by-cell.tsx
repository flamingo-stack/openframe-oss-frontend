'use client';

import { SOFTWARE_SOURCE_LABEL } from '@flamingo-stack/openframe-frontend-core/components/features';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { softwareDeviceInstalledByCell_softwareOnDevice$key } from '@/__generated__/softwareDeviceInstalledByCell_softwareOnDevice.graphql';
import { ValueText } from '@/app/components/shared';
import { presentationFor } from '@/lib/exhaustive-map';

const softwareDeviceInstalledByCellFragment = graphql`
  fragment softwareDeviceInstalledByCell_softwareOnDevice on SoftwareOnDevice {
    installedBy
  }
`;

/**
 * INSTALLED BY column: the package manager that installed the copy on this device; the empty mark when it is not
 * known. The design's "Manually" and adoption chips are not drawn: the API reports neither yet.
 */
export function SoftwareDeviceInstalledByCell({
  softwareOnDevice,
}: {
  softwareOnDevice: softwareDeviceInstalledByCell_softwareOnDevice$key;
}) {
  // A row still being read (a loading scope) has no fragment to read: `ValueText` draws its bar.
  const data = useFragment(softwareDeviceInstalledByCellFragment, useLoadingScope() ? null : softwareOnDevice);
  const source = data?.installedBy;
  return (
    <ValueText
      value={data ? (source ? (presentationFor(SOFTWARE_SOURCE_LABEL, source) ?? source) : null) : undefined}
    />
  );
}
