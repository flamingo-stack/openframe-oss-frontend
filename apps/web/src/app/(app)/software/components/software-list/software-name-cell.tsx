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

/**
 * SOFTWARE column: the title, its publisher underneath (design 1076:16413). Fleet knows the publisher of few titles, so
 * most rows have the title alone, and a row still loading draws no bar for it.
 */
export function SoftwareNameCell({ software }: { software: softwareNameCell_software$key }) {
  // A row still being read (a loading scope) has no fragment to read: the cell draws the title as a bar.
  const data = useFragment(softwareNameCellFragment, useLoadingScope() ? null : software);
  return (
    <div className="flex min-w-0 flex-col justify-center">
      <TruncateText>{data?.name ?? ''}</TruncateText>
      {data?.publisher && (
        <div data-loading-optional className="min-w-0">
          <TruncateText variant="h6" tone="secondary">
            {data.publisher}
          </TruncateText>
        </div>
      )}
    </div>
  );
}
