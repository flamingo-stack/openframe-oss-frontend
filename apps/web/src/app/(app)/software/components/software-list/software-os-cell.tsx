'use client';

import { OSTypeIcon } from '@flamingo-stack/openframe-frontend-core/components/features';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { getOSLabel } from '@flamingo-stack/openframe-frontend-core/utils';
import { graphql, useFragment } from 'react-relay';
import type { softwareOsCell_software$key } from '@/__generated__/softwareOsCell_software.graphql';
import { ValueText } from '@/app/components/shared';

const softwareOsCellFragment = graphql`
  fragment softwareOsCell_software on Software {
    os
  }
`;

/** OS column (design 1076:16413): the system's logo, named for a screen reader; the empty mark for a kind several systems have. */
export function SoftwareOsCell({ software }: { software: softwareOsCell_software$key }) {
  // A row still being read (a loading scope) has no fragment to read: the cell draws its bar.
  const data = useFragment(softwareOsCellFragment, useLoadingScope() ? null : software);
  if (!data?.os) return <ValueText value={data ? null : undefined} />;
  const label = getOSLabel(data.os);
  return (
    <span role="img" aria-label={label} title={label} className="flex text-ods-text-secondary">
      <OSTypeIcon osType={data.os} size="size-5" />
    </span>
  );
}
