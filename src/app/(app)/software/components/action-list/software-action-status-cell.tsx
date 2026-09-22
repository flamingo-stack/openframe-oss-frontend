'use client';

import { TruncateText } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { softwareActionStatusCell_action$key } from '@/__generated__/softwareActionStatusCell_action.graphql';
import { SoftwareActionStatus } from '@/generated/schema-enums';
import { formatDateTime } from '@/lib/format-date';
import { SoftwareActionStatusTag } from './software-action-status-tag';

const softwareActionStatusCellFragment = graphql`
  fragment softwareActionStatusCell_action on SoftwareActionRun {
    status
    scheduledAt
  }
`;

/** STATUS column: the run's state — and, for one still waiting on its schedule, when it fires. */
export function SoftwareActionStatusCell({ action }: { action: softwareActionStatusCell_action$key }) {
  const { status, scheduledAt } = useFragment(softwareActionStatusCellFragment, action);
  return (
    <div className="flex min-w-0 flex-col items-start justify-center">
      <SoftwareActionStatusTag status={status} />
      {status === SoftwareActionStatus.SCHEDULED && scheduledAt && (
        <TruncateText variant="h6" tone="secondary">
          {formatDateTime(scheduledAt)}
        </TruncateText>
      )}
    </div>
  );
}
