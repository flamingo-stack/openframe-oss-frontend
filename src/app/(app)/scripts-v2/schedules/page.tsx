'use client';

import { ContentErrorBoundary } from '@/app/components/shared';
import { ScriptSchedulesTable } from '../../scripts/v2/schedule/components/script-schedules-table';
import { ScriptsV2TabNavigation } from '../../scripts/v2/shared/components/scripts-v2-tabs';

export default function ScriptSchedulesV2Page() {
  return (
    <div className="flex flex-col w-full">
      <ScriptsV2TabNavigation activeTab="schedules" />
      <ContentErrorBoundary title="Schedules" message="Couldn't load schedules.">
        <ScriptSchedulesTable />
      </ContentErrorBoundary>
    </div>
  );
}
