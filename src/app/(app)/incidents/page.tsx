'use client';

import { notFound } from 'next/navigation';
import { ContentErrorBoundary, ListPageSkeleton } from '@/app/components/shared';
import { useFeatureFlagGate } from '@/app/hooks/use-feature-flag';
import { isSaasTenantMode } from '@/lib/app-mode';
import { IncidentsTable } from './components/incidents-table';
import { INCIDENTS_TABLE_COLUMNS } from './components/incidents-table-columns';

export default function IncidentsPage() {
  const gate = useFeatureFlagGate('insights');

  // The insights API exists only in saas-api, so the page is saas-tenant only.
  // Only a definitive flag "off" 404s: `notFound()` throws, and throwing while
  // the flags are merely unanswered is unrecoverable (see notifications/page.tsx).
  if (!isSaasTenantMode() || gate === 'off') {
    notFound();
  }
  if (gate === 'loading') {
    return <ListPageSkeleton title="Incidents" columns={INCIDENTS_TABLE_COLUMNS} />;
  }

  return (
    <ContentErrorBoundary title="Incidents" message="Couldn't load incidents.">
      <IncidentsTable />
    </ContentErrorBoundary>
  );
}
