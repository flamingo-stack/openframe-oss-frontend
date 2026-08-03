'use client';

import { useRequiredIdParam } from '@/app/hooks/use-required-id-param';
import { routes } from '@/lib/routes';
import { EditSchedulePage } from '../../../scripts/v2/schedule/components/edit-schedule-page';

export default function EditScheduleV2Page() {
  const id = useRequiredIdParam('/scripts-v2/schedules', routes.scriptsV2.schedules.new);
  if (!id) return null;

  // No boundary here: the page paints its own chrome and its (locked) form on
  // the first render, and suspends only around the loader that reads the record.
  return <EditSchedulePage scheduleId={id} />;
}
