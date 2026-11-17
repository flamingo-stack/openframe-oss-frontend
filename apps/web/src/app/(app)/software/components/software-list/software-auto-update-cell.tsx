'use client';

import { TextLineSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { softwareAutoUpdateCell_software$key } from '@/__generated__/softwareAutoUpdateCell_software.graphql';
import { AutoUpdateStatusValue } from '../shared/auto-update-status';

const softwareAutoUpdateCellFragment = graphql`
  fragment softwareAutoUpdateCell_software on Software {
    autoUpdate
  }
`;

/** AUTO-UPDATE column: whether an auto-update policy keeps the title updated. */
export function SoftwareAutoUpdateCell({ software }: { software: softwareAutoUpdateCell_software$key }) {
  // A row still being read (a loading scope) has no fragment to read: the cell draws its bar.
  const data = useFragment(softwareAutoUpdateCellFragment, useLoadingScope() ? null : software);
  if (!data) return <TextLineSkeleton type="h4" as="span" className="w-10" />;
  return <AutoUpdateStatusValue status={data.autoUpdate} />;
}
