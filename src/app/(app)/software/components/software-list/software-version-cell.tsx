'use client';

import { Tag } from '@flamingo-stack/openframe-frontend-core';
import { TruncateText } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { softwareVersionCell_software$key } from '@/__generated__/softwareVersionCell_software.graphql';
import { ValueText } from '@/app/components/shared';
import { SoftwareVersionStatus } from '@/generated/schema-enums';
import { pluralize } from '@/lib/pluralize';
import { OUTDATED_TAG } from '../shared/outdated-tag';

const softwareVersionCellFragment = graphql`
  fragment softwareVersionCell_software on Software {
    currentVersion
    versionStatus
    olderVersionsCount
  }
`;

/**
 * CURRENT VERSION column: the most recent version installed anywhere in the
 * fleet (empty when none reported), and how many older ones are still in use.
 */
export function SoftwareVersionCell({ software }: { software: softwareVersionCell_software$key }) {
  const { currentVersion, versionStatus, olderVersionsCount } = useFragment(softwareVersionCellFragment, software);
  const olderCount = olderVersionsCount ?? 0;
  return (
    <div className="flex min-w-0 flex-col justify-center">
      <div className="flex min-w-0 items-center gap-[var(--spacing-system-xxs)]">
        <ValueText value={currentVersion} />
        {versionStatus === SoftwareVersionStatus.OUTDATED && (
          <Tag label={OUTDATED_TAG.label} variant={OUTDATED_TAG.variant} />
        )}
      </div>
      {olderCount > 0 && (
        <TruncateText variant="h6" tone="secondary">
          {`+${pluralize(olderCount, 'older version')}`}
        </TruncateText>
      )}
    </div>
  );
}
