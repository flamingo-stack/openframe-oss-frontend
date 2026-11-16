'use client';

import { isDeviceLocalTime } from '@flamingo-stack/openframe-frontend-core/components/features';
import { TruncateText, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { softwareActionStatusCell_action$key } from '@/__generated__/softwareActionStatusCell_action.graphql';
import { DEVICE_LOCAL_TIME_NOTE, formatScheduleStartAt } from '@/app/(app)/scripts/schedule/utils/schedule-timing';
import { SoftwareActionStatus } from '@/generated/schema-enums';
import { SoftwareActionStatusTag } from './software-action-status-tag';

const softwareActionStatusCellFragment = graphql`
  fragment softwareActionStatusCell_action on SoftwareActionRun {
    status
    scheduledAt
    timeReference
  }
`;

/**
 * STATUS column: the run's state — and, for one still waiting on its schedule, when it fires. A run on each device's
 * own clock shows that reading, named as such: a bare time would read as the viewer's.
 */
export function SoftwareActionStatusCell({ action }: { action: softwareActionStatusCell_action$key }) {
  // A row still being read (a loading scope) has no fragment to read: the cell draws its loading form (an empty tag is the tag's skeleton).
  const data = useFragment(softwareActionStatusCellFragment, useLoadingScope() ? null : action);
  return (
    <div className="flex min-w-0 flex-col items-start justify-center">
      <SoftwareActionStatusTag status={data?.status ?? ''} />
      {data?.status === SoftwareActionStatus.SCHEDULED && data.scheduledAt && (
        <TruncateText variant="h6" tone="secondary">
          {scheduledLabel(data.scheduledAt, data.timeReference)}
        </TruncateText>
      )}
    </div>
  );
}

function scheduledLabel(scheduledAt: string, timeReference: string | null | undefined): string {
  const { date, time } = formatScheduleStartAt(scheduledAt, timeReference);
  return isDeviceLocalTime(timeReference) ? `${date}, ${time} (${DEVICE_LOCAL_TIME_NOTE})` : `${date}, ${time}`;
}
