'use client';

import { isDeviceLocalTime } from '@flamingo-stack/openframe-frontend-core/components/features';
import { DataTable, TruncateText, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
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
    // Below md the column is as wide as its content, beside the open button (mobile frame 1049:16193).
    <div className="flex min-w-0 flex-col items-end justify-center content-md:items-start">
      <SoftwareActionStatusTag status={data?.status ?? ''} />
      {data?.status === SoftwareActionStatus.SCHEDULED && data.scheduledAt && (
        <ScheduledAt scheduledAt={data.scheduledAt} timeReference={data.timeReference} />
      )}
    </div>
  );
}

function ScheduledAt({
  scheduledAt,
  timeReference,
}: {
  scheduledAt: string;
  timeReference: string | null | undefined;
}) {
  const { date, time } = formatScheduleStartAt(scheduledAt, timeReference);
  // The device-local note on a line of its own: in parentheses after the time it was cut off at every width.
  return (
    <>
      <TruncateText variant="h6" tone="secondary">{`${date}, ${time}`}</TruncateText>
      {isDeviceLocalTime(timeReference) && (
        <TruncateText variant="h6" tone="secondary">
          {DEVICE_LOCAL_TIME_NOTE}
        </TruncateText>
      )}
    </>
  );
}

/**
 * STATUS column in the grid layout: one line, the run's state and, for one still waiting on its schedule, when it
 * fires (named as each device's own clock where it is).
 */
export function SoftwareActionStatusGridCell({ action }: { action: softwareActionStatusCell_action$key }) {
  // A row still being read (a loading scope) has no fragment to read: an empty tag is the tag's skeleton.
  const data = useFragment(softwareActionStatusCellFragment, useLoadingScope() ? null : action);
  return (
    <DataTable.Cell
      tag={<SoftwareActionStatusTag status={data?.status ?? ''} />}
      secondary={
        data?.status === SoftwareActionStatus.SCHEDULED && data.scheduledAt
          ? scheduledAtLine(data.scheduledAt, data.timeReference)
          : undefined
      }
    />
  );
}

/** "20 Nov 2026, 09:30", with the device-local note after it where the run fires on each device's own clock. */
function scheduledAtLine(scheduledAt: string, timeReference: string | null | undefined): string {
  const { date, time } = formatScheduleStartAt(scheduledAt, timeReference);
  return isDeviceLocalTime(timeReference) ? `${date}, ${time}, ${DEVICE_LOCAL_TIME_NOTE}` : `${date}, ${time}`;
}
