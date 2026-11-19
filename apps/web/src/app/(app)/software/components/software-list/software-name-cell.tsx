'use client';

import { TruncateText, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { softwareNameCell_software$key } from '@/__generated__/softwareNameCell_software.graphql';
import { SoftwareOsIcon } from './software-os-cell';

const softwareNameCellFragment = graphql`
  fragment softwareNameCell_software on Software {
    name
    publisher
    os
    currentVersion
  }
`;

/**
 * SOFTWARE column: the title, its publisher underneath (design 1076:16413). Fleet knows the publisher of few titles, so
 * most rows have the title alone, and a row still loading draws no bar for it.
 *
 * Where the columns beside it are hidden the cell carries them (tablet 1098:309, phone 1098:17357): the system's logo
 * before the title below desktop width (`withOs`, the fleet's list), and on a phone the current version in place of the
 * publisher.
 */
export function SoftwareNameCell({
  software,
  withOs = false,
}: {
  software: softwareNameCell_software$key;
  withOs?: boolean;
}) {
  // A row still being read (a loading scope) has no fragment to read: the cell draws the title as a bar.
  const data = useFragment(softwareNameCellFragment, useLoadingScope() ? null : software);
  return (
    <div className="flex min-w-0 flex-col justify-center">
      <div className="flex min-w-0 items-center gap-[var(--spacing-system-xs)]">
        {withOs && data?.os && <SoftwareOsIcon os={data.os} className="content-lg:hidden" />}
        <TruncateText>{data?.name ?? ''}</TruncateText>
      </div>
      {data?.publisher && (
        <TruncateText variant="h6" tone="secondary" className="hidden content-md:block" data-loading-optional>
          {data.publisher}
        </TruncateText>
      )}
      {data && (
        <TruncateText variant="h6" tone="secondary" className="content-md:hidden">
          {data.currentVersion || 'Unknown version'}
        </TruncateText>
      )}
    </div>
  );
}
