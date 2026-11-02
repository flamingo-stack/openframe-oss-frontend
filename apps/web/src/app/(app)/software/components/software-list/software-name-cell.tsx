'use client';

import { TruncateText, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { softwareNameCell_software$key } from '@/__generated__/softwareNameCell_software.graphql';

const softwareNameCellFragment = graphql`
  fragment softwareNameCell_software on Software {
    name
    publisher
  }
`;

/** SOFTWARE column: the title, its publisher underneath. */
export function SoftwareNameCell({ software }: { software: softwareNameCell_software$key }) {
  // A row still being read (a loading scope) has no fragment to read: the cell draws the title and its publisher as bars.
  const loading = useLoadingScope();
  const data = useFragment(softwareNameCellFragment, loading ? null : software);
  return (
    <div className="flex min-w-0 flex-col justify-center">
      <TruncateText>{data?.name ?? ''}</TruncateText>
      {(loading || data?.publisher) && (
        <TruncateText variant="h6" tone="secondary">
          {data?.publisher ?? ''}
        </TruncateText>
      )}
    </div>
  );
}
