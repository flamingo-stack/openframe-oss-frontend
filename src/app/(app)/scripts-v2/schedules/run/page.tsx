'use client';

import { useSearchParams } from 'next/navigation';
import { ScheduleRunDetailsView } from '../../../scripts/v2/schedule/components/schedule-run-details-view';

export default function ScheduleRunDetailsV2Page() {
  const id = useSearchParams().get('id') ?? '';
  return <ScheduleRunDetailsView runId={id} />;
}
