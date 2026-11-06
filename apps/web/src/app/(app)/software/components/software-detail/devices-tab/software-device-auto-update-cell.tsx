'use client';

import { TextLineSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { softwareDeviceAutoUpdateCell_softwareOnDevice$key } from '@/__generated__/softwareDeviceAutoUpdateCell_softwareOnDevice.graphql';
import { AutoUpdateStatusValue } from '../../shared/auto-update-status';

const softwareDeviceAutoUpdateCellFragment = graphql`
  fragment softwareDeviceAutoUpdateCell_softwareOnDevice on SoftwareOnDevice {
    autoUpdate
  }
`;

/** AUTO-UPDATE column: whether an auto-update policy keeps this device's copy updated. */
export function SoftwareDeviceAutoUpdateCell({
  softwareOnDevice,
}: {
  softwareOnDevice: softwareDeviceAutoUpdateCell_softwareOnDevice$key;
}) {
  // A row still being read (a loading scope) has no fragment to read: the cell draws its bar.
  const data = useFragment(softwareDeviceAutoUpdateCellFragment, useLoadingScope() ? null : softwareOnDevice);
  if (!data) return <TextLineSkeleton type="h4" as="span" className="w-10" />;
  return <AutoUpdateStatusValue status={data.autoUpdate} />;
}
