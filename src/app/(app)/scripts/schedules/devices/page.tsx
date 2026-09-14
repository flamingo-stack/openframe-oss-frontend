'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { ScheduleDevicesSkeleton } from '../../schedule/components/schedule-devices-skeleton';
import { ScheduleDevicesView } from '../../schedule/components/schedule-devices-view';

export default function ScheduleDevicesPage() {
  const id = useSearchParams().get('id') ?? '';

  return (
    <Suspense fallback={<ScheduleDevicesSkeleton scheduleId={id} />}>
      <ScheduleDevicesView scheduleId={id} />
    </Suspense>
  );
}
