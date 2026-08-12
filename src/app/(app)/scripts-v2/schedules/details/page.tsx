'use client';

import { useSearchParams } from 'next/navigation';
import { ContentErrorBoundary } from '@/app/components/shared';
import { ScheduleDetailsView } from '../../../scripts/v2/schedule/components/schedule-details-view';

export default function ScheduleDetailsV2Page() {
  const id = useSearchParams().get('id') ?? '';
  return (
    <ContentErrorBoundary title="Schedule" message="Couldn't load this schedule.">
      <ScheduleDetailsView scheduleId={id} />
    </ContentErrorBoundary>
  );
}
