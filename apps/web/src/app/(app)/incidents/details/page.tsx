'use client';

import { LoadingWhen } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { notFound } from 'next/navigation';
import { ContentErrorBoundary } from '@/app/components/shared';
import { useRequiredIdParam } from '@/app/hooks/use-required-id-param';
import { routes } from '@/lib/routes';
import { IncidentDetailsView } from '../components/incident-details-view';
import { useIncidentsGate } from '../hooks/use-incidents-gate';

export default function IncidentDetailsPage() {
  const gate = useIncidentsGate();
  // A missing `?id=` goes back to the list instead of asking the API for "".
  const id = useRequiredIdParam(routes.incidents.list);

  // Same gate as the list: only a definitive "off" 404s (`notFound()` throws —
  // see `use-feature-flag.ts`).
  if (gate === 'off') {
    notFound();
  }
  if (id === null) {
    return null;
  }

  // While the flag is unanswered the page draws itself in a loading scope: each part its own skeleton.
  return (
    <ContentErrorBoundary title="Incident" message="Couldn't load this incident.">
      <LoadingWhen loading={gate === 'loading'}>
        <IncidentDetailsView incidentId={id} />
      </LoadingWhen>
    </ContentErrorBoundary>
  );
}
