'use client';

import { ContentErrorBoundary } from '@/app/components/shared';
import { ScriptsTable } from './script/components/scripts-table';
import { ScriptsTabNavigation } from './shared/components/scripts-tabs';

export default function ScriptsPage() {
  return (
    <div className="flex w-full flex-col">
      <ScriptsTabNavigation activeTab="list" />
      <ContentErrorBoundary title="Scripts" message="Couldn't load scripts.">
        <ScriptsTable />
      </ContentErrorBoundary>
    </div>
  );
}
