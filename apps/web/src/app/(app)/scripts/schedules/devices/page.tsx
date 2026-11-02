'use client';

import { useSearchParams } from 'next/navigation';
import { ScheduleDevicesView } from '../../schedule/components/schedule-devices-view';

export default function ScheduleDevicesPage() {
  const id = useSearchParams().get('id') ?? '';

  // The view owns its Suspense boundary: while the schedule loads it draws itself without it.
  return <ScheduleDevicesView scheduleId={id} />;
}
