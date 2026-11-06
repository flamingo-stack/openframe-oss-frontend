'use client';

import { EntityImage, TruncateText, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
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
 * logo and contact address are not drawn: the tile stands for the logo.
 */
export function SoftwareLogCustomerCell({ device }: { device: softwareLogCustomerCell_device$key | null | undefined }) {
  // A row still being read (a loading scope) has no fragment to read: the tile and the name draw their bars.
  const loading = useLoadingScope();
  const data = useFragment(softwareLogCustomerCellFragment, loading ? null : device);
  const name = data?.organizationName;

  if (!loading && !name) return <ValueText value={null} />;

  return (
    <div className="flex min-w-0 items-center gap-[var(--spacing-system-mf)]">
      <EntityImage src={undefined} alt={name ?? ''} sizeClassName="size-12" className="rounded-[4px]" />
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <TruncateText>{name ?? ''}</TruncateText>
      </div>
    </div>
  );
}
