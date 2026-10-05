'use client';

import { useSearchParams } from 'next/navigation';
import { ScheduleRunDetailsView } from '../../schedule/components/schedule-run-details-view';

export default function ScheduleRunDetailsPage() {
  const id = useSearchParams().get('id') ?? '';
  return <ScheduleRunDetailsView runId={id} />;
}
