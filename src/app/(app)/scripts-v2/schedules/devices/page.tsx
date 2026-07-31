'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { ScheduleDevicesSkeleton } from '../../../scripts/v2/schedule/components/schedule-devices-skeleton';
import { ScheduleDevicesView } from '../../../scripts/v2/schedule/components/schedule-devices-view';

export default function ScheduleDevicesV2Page() {
  const id = useSearchParams().get('id') ?? '';

  return (
    <Suspense fallback={<ScheduleDevicesSkeleton scheduleId={id} />}>
      <ScheduleDevicesView scheduleId={id} />
    </Suspense>
  );
}
