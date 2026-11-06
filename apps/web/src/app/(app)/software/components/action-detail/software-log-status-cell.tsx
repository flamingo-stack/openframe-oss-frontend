'use client';

import { TextLineSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { TruncateText, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { softwareLogStatusCell_device$key } from '@/__generated__/softwareLogStatusCell_device.graphql';
import { formatDateTime } from '@/lib/format-date';
import { SoftwareActionStatusTag } from '../action-list/software-action-status-tag';

const softwareLogStatusCellFragment = graphql`
  fragment softwareLogStatusCell_device on SoftwareActionDevice {
    status
    dispatchedAt
    finishedAt
  }
`;

interface SoftwareLogStatusCellProps {
  device: softwareLogStatusCell_device$key;
  /** "Update" / "Install" — the first word of the cell. */
  actionLabel: string;
}

/**
 * STATUS column: where this device's run is (the list's own chips: Scheduled, In Progress, Waiting, Success, Failed),
 * and when it finished, or was sent while it has not. A device still waiting for its schedule or to come online has
 * neither.
 */
export function SoftwareLogStatusCell({ device, actionLabel }: SoftwareLogStatusCellProps) {
  // A row still being read (a loading scope) has no fragment to read: the tag and the date draw their bars, and so
  // does the action word until the run it names is read.
  const loading = useLoadingScope();
  const data = useFragment(softwareLogStatusCellFragment, loading ? null : device);
  const at = data?.finishedAt ?? data?.dispatchedAt;
  return (
    <div className="flex min-w-0 flex-col justify-center">
      <div className="flex min-w-0 items-center gap-[var(--spacing-system-xxs)]">
        {actionLabel || !loading ? (
          <span className="text-ods-text-primary text-h4">{actionLabel}</span>
        ) : (
          <TextLineSkeleton type="h4" as="span" className="w-16" />
        )}
        <SoftwareActionStatusTag status={data?.status ?? ''} />
      </div>
      {(loading || at) && (
        <TruncateText variant="h6" tone="secondary">
          {at ? formatDateTime(at) : ''}
        </TruncateText>
      )}
    </div>
  );
}
