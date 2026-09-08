'use client';

import { useRequiredIdParam } from '@/app/hooks/use-required-id-param';
import { routes } from '@/lib/routes';
import { EditSchedulePage } from '../../schedule/components/edit-schedule-page';

export default function EditSchedulePageWrapper() {
  const id = useRequiredIdParam('/scripts/schedules', routes.scripts.schedules.new);
  if (!id) return null;

  // No boundary here: the page paints its own chrome and its (locked) form on
  // the first render, and suspends only around the loader that reads the record.
  return <EditSchedulePage scheduleId={id} />;
}
