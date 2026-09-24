'use client';

import { ContentErrorBoundary } from '@/app/components/shared';
import { ScriptSchedulesTable } from '../schedule/components/script-schedules-table';
import { ScriptsTabNavigation } from '../shared/components/scripts-tabs';

export default function ScriptSchedulesPage() {
  return (
    <div className="flex w-full flex-col">
      <ScriptsTabNavigation activeTab="schedules" />
      <ContentErrorBoundary title="Schedules" message="Couldn't load schedules.">
        <ScriptSchedulesTable />
      </ContentErrorBoundary>
    </div>
  );
}
