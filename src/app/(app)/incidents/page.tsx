'use client';

import { notFound } from 'next/navigation';
import { ContentErrorBoundary, ListPageSkeleton } from '@/app/components/shared';
import { IncidentsTable } from './components/incidents-table';
import { INCIDENTS_TABLE_COLUMNS } from './components/incidents-table-columns';
import { useIncidentsGate } from './hooks/use-incidents-gate';

export default function IncidentsPage() {
  const gate = useIncidentsGate();

  // Only a definitive "off" 404s: `notFound()` throws, and throwing while the
  // flags are merely unanswered is unrecoverable (see notifications/page.tsx).
  if (gate === 'off') {
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
