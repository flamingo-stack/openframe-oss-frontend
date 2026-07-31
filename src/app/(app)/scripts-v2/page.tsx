'use client';

import { ScriptsTable } from '../scripts/v2/script/components/scripts-table';
import { ScriptsV2TabNavigation } from '../scripts/v2/shared/components/scripts-v2-tabs';

export default function ScriptsV2Page() {
  return (
    <div className="flex flex-col w-full">
      <ScriptsV2TabNavigation activeTab="list" />
      <ScriptsTable />
    </div>
  );
}
