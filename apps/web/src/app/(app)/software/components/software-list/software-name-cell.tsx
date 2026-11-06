'use client';

import { TruncateText, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { softwareNameCell_software$key } from '@/__generated__/softwareNameCell_software.graphql';

const softwareNameCellFragment = graphql`
  fragment softwareNameCell_software on Software {
    name
  }
`;

/** SOFTWARE column: the title. The design's publisher underneath is not drawn: the API never fills it for a title. */
export function SoftwareNameCell({ software }: { software: softwareNameCell_software$key }) {
  // A row still being read (a loading scope) has no fragment to read: the cell draws the title as a bar.
  const data = useFragment(softwareNameCellFragment, useLoadingScope() ? null : software);
  return <TruncateText>{data?.name ?? ''}</TruncateText>;
}
