'use client';

import { ContentErrorBoundary } from '@/app/components/shared';
import { LogsTable } from './components/logs-table';

export default function Logs() {
  return (
    <div className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]">
      <ContentErrorBoundary title="Logs" message="Couldn't load logs.">
        <LogsTable />
      </ContentErrorBoundary>
    </div>
  );
}
