'use client';

import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { softwareLogCustomerCell_device$key } from '@/__generated__/softwareLogCustomerCell_device.graphql';
import { ValueText } from '@/app/components/shared';

const softwareLogCustomerCellFragment = graphql`
  fragment softwareLogCustomerCell_device on SoftwareActionDevice {
    organizationName
  }
`;

/**
 * CUSTOMER column: the device's customer. The run's device row carries the customer's name only, so the design's
 * logo and contact address are not drawn.
 */
export function SoftwareLogCustomerCell({ device }: { device: softwareLogCustomerCell_device$key | null | undefined }) {
  // A row still being read (a loading scope) has no fragment to read: `ValueText` draws its bar.
  const data = useFragment(softwareLogCustomerCellFragment, useLoadingScope() ? null : device);
  return <ValueText value={data ? data.organizationName : undefined} />;
}
