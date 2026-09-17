'use client';

import { notFound } from 'next/navigation';
import { ContentErrorBoundary } from '@/app/components/shared';
import { useFeatureFlagGate } from '@/app/hooks/use-feature-flag';
import { useRequiredIdParam } from '@/app/hooks/use-required-id-param';
import { isSaasTenantMode } from '@/lib/app-mode';
import { routes } from '@/lib/routes';
import { IncidentDetailsSkeleton, IncidentDetailsView } from '../components/incident-details-view';

export default function IncidentDetailsPage() {
  const gate = useFeatureFlagGate('insights');
  // A missing `?id=` goes back to the list instead of asking the API for "".
  const id = useRequiredIdParam(routes.incidents.list);

  // Same gate as the list: saas-tenant only, and only a definitive flag "off"
  // 404s (`notFound()` throws — see notifications/page.tsx).
  if (!isSaasTenantMode() || gate === 'off') {
    notFound();
  }
  if (id === null) {
    return null;
  }
  if (gate === 'loading') {
    return <IncidentDetailsSkeleton />;
  }

  return (
    <ContentErrorBoundary title="Incident" message="Couldn't load this incident.">
      <IncidentDetailsView incidentId={id} />
    </ContentErrorBoundary>
  );
}
