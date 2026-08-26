'use client';

import { ContentErrorBoundary } from '@/app/components/shared';
import { ScriptsTable } from '../script/components/scripts-table';

export default function ArchivedScriptsPage() {
  return (
    <ContentErrorBoundary title="Archived Scripts" message="Couldn't load archived scripts.">
      <ScriptsTable archived />
    </ContentErrorBoundary>
  );
}
