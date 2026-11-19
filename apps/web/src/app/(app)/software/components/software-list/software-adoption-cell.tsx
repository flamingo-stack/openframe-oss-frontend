'use client';

import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { softwareAdoptionCell_software$key } from '@/__generated__/softwareAdoptionCell_software.graphql';
import { ValueText } from '@/app/components/shared';

const softwareAdoptionCellFragment = graphql`
  fragment softwareAdoptionCell_software on Software {
    adoptionCount
  }
`;

/**
 * ADOPTION column (design 1076:16413): on how many devices Adopt would reinstall the title, the server's count of the
 * devices an order would actually reach. The empty mark for none (0, or a title with no adoption package).
 */
export function SoftwareAdoptionCell({ software }: { software: softwareAdoptionCell_software$key }) {
  // A row still being read (a loading scope) has no fragment to read: `ValueText` draws its bar.
  const data = useFragment(softwareAdoptionCellFragment, useLoadingScope() ? null : software);
  const count = data?.adoptionCount;
  return <ValueText value={data ? (count ? count : null) : undefined} skeletonWidth="w-8" />;
}
