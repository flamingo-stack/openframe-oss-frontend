'use client';

import { ContentErrorBoundary } from '@/app/components/shared';
import { ScriptSchedulesTable } from '../../schedule/components/script-schedules-table';

export default function ArchivedScriptSchedulesPage() {
  return (
    <ContentErrorBoundary title="Archived Schedules" message="Couldn't load archived schedules.">
      <ScriptSchedulesTable archived />
    </ContentErrorBoundary>
  );
}
