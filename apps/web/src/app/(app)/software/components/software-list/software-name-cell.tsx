'use client';

import { TruncateText } from '@flamingo-stack/openframe-frontend-core/components/ui';
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
  const { name, publisher } = useFragment(softwareNameCellFragment, software);
  return (
    <div className="flex min-w-0 flex-col justify-center">
      <TruncateText>{name}</TruncateText>
      {publisher && (
        <TruncateText variant="h6" tone="secondary">
          {publisher}
        </TruncateText>
      )}
    </div>
  );
}
