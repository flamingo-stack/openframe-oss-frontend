'use client';

import { graphql, useFragment } from 'react-relay';
import type { softwareDevicesCell_software$key } from '@/__generated__/softwareDevicesCell_software.graphql';
import { ValueText } from '@/app/components/shared';
import { formatCount } from '@/lib/format-number';

const softwareDevicesCellFragment = graphql`
  fragment softwareDevicesCell_software on Software {
    devicesCount
  }
`;

/** DEVICES column: how many machines carry this title. */
export function SoftwareDevicesCell({ software }: { software: softwareDevicesCell_software$key }) {
  const { devicesCount } = useFragment(softwareDevicesCellFragment, software);
  return <ValueText value={formatCount(devicesCount)} />;
}
