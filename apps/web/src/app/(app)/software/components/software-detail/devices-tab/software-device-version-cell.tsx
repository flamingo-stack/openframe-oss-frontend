'use client';

import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { softwareDeviceVersionCell_softwareOnDevice$key } from '@/__generated__/softwareDeviceVersionCell_softwareOnDevice.graphql';
import { ValueText } from '@/app/components/shared';
import { SoftwareDeviceAdoptionTag } from './software-device-adoption-tag';
import { SoftwareOnDeviceStatusTag } from './software-on-device-status-tag';

const softwareDeviceVersionCellFragment = graphql`
  fragment softwareDeviceVersionCell_softwareOnDevice on SoftwareOnDevice {
    softwareVersion
    status
    ...softwareDeviceAdoptionTag_softwareOnDevice
  }
`;

/**
 * SOFTWARE VERSION column: the version THIS device runs, and its lifecycle chip. Below 720px of content the MANAGED BY
 * column is hidden (`hideAt: 'md'`), and the adoption chip it carries moves here, so a device's adoption is on screen
 * however narrow the page is (the docked chat's columns leave it under 720px on most windows).
 */
export function SoftwareDeviceVersionCell({
  softwareOnDevice,
}: {
  softwareOnDevice: softwareDeviceVersionCell_softwareOnDevice$key;
}) {
  // A row still being read (a loading scope) has no fragment to read: `ValueText` draws its bar.
  const data = useFragment(softwareDeviceVersionCellFragment, useLoadingScope() ? null : softwareOnDevice);
  return (
    <div className="flex min-w-0 flex-col gap-[var(--spacing-system-xxs)]">
      <div className="flex min-w-0 items-center gap-[var(--spacing-system-xxs)]">
        <ValueText value={data?.softwareVersion} />
        <SoftwareOnDeviceStatusTag status={data?.status} />
      </div>
      <SoftwareDeviceAdoptionTag softwareOnDevice={data ?? null} className="content-md:hidden" />
    </div>
  );
}
