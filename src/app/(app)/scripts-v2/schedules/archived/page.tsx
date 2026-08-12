'use client';

import { ContentErrorBoundary } from '@/app/components/shared';
import { ScriptSchedulesTable } from '../../../scripts/v2/schedule/components/script-schedules-table';

export default function ArchivedScriptSchedulesV2Page() {
  return (
    <ContentErrorBoundary title="Archived Schedules" message="Couldn't load archived schedules.">
      <ScriptSchedulesTable archived />
    </ContentErrorBoundary>
  );
}
