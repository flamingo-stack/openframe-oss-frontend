'use client';

import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { softwareAdoptionCell_software$key } from '@/__generated__/softwareAdoptionCell_software.graphql';
import { ValueText } from '@/app/components/shared';
import { formatCount } from '@/lib/format-number';

const softwareAdoptionCellFragment = graphql`
  fragment softwareAdoptionCell_software on Software {
    adoptionCount
  }
`;

/** ADOPTION column: how many devices have the title installed by hand and can be adopted — none reads as the mark. */
export function SoftwareAdoptionCell({ software }: { software: softwareAdoptionCell_software$key }) {
  // A row still being read (a loading scope) has no fragment to read: the cell draws its bar.
  const data = useFragment(softwareAdoptionCellFragment, useLoadingScope() ? null : software);
  const count = data?.adoptionCount;
  return <ValueText value={data ? (count ? formatCount(count) : null) : undefined} />;
}
