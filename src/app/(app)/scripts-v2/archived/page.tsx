'use client';

import { ContentErrorBoundary } from '@/app/components/shared';
import { ScriptsTable } from '../../scripts/v2/script/components/scripts-table';

export default function ArchivedScriptsV2Page() {
  return (
    <ContentErrorBoundary title="Archived Scripts" message="Couldn't load archived scripts.">
      <ScriptsTable archived />
    </ContentErrorBoundary>
  );
}
