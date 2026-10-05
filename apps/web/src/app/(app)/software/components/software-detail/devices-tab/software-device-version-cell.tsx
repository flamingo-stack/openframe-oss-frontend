'use client';

import { graphql, useFragment } from 'react-relay';
import type { softwareDeviceVersionCell_softwareOnDevice$key } from '@/__generated__/softwareDeviceVersionCell_softwareOnDevice.graphql';
import { ValueText } from '@/app/components/shared';
import { SoftwareOnDeviceStatusTag } from './software-on-device-status-tag';

const softwareDeviceVersionCellFragment = graphql`
  fragment softwareDeviceVersionCell_softwareOnDevice on SoftwareOnDevice {
    softwareVersion
    status
  }
`;

/** SOFTWARE VERSION column: the version THIS device runs, and its lifecycle chip. */
export function SoftwareDeviceVersionCell({
  softwareOnDevice,
}: {
  softwareOnDevice: softwareDeviceVersionCell_softwareOnDevice$key;
}) {
  const { softwareVersion, status } = useFragment(softwareDeviceVersionCellFragment, softwareOnDevice);
  return (
    <div className="flex min-w-0 items-center gap-[var(--spacing-system-xxs)]">
      <ValueText value={softwareVersion} />
      <SoftwareOnDeviceStatusTag status={status} />
    </div>
  );
}
