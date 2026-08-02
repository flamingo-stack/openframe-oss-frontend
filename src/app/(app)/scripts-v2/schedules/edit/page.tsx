'use client';

import { Suspense } from 'react';
import { useRequiredIdParam } from '@/app/hooks/use-required-id-param';
import { routes } from '@/lib/routes';
import { EditSchedulePage } from '../../../scripts/v2/schedule/components/edit-schedule-page';
import { EditScheduleSkeleton } from '../../../scripts/v2/schedule/components/edit-schedule-skeleton';

export default function EditScheduleV2Page() {
  const id = useRequiredIdParam('/scripts-v2/schedules', routes.scriptsV2.schedules.new);
  if (!id) return null;

  return (
    <Suspense fallback={<EditScheduleSkeleton scheduleId={id} />}>
      <EditSchedulePage scheduleId={id} />
    </Suspense>
  );
}
