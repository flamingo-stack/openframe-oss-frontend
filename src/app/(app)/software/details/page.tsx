'use client';

import { useRequiredIdParam } from '@/app/hooks/use-required-id-param';
import { routes } from '@/lib/routes';
import { SoftwarePageShell } from '../components/shared/software-page-shell';
import { useSoftwareManagementGate } from '../components/shared/use-software-management-gate';
import { SOFTWARE_DETAIL_TITLE } from '../components/software-detail/software-detail-title';
import { SoftwareDetailView } from '../components/software-detail/software-detail-view';

export default function SoftwareDetailsPage() {
  const gate = useSoftwareManagementGate();
  // A missing id is a truncated link, not a page: bounce to the list rather than
  // querying `software(id: "")` and reporting it as "not found".
  const softwareId = useRequiredIdParam(routes.software.list);

  if (!softwareId) return null;

  return (
    <SoftwarePageShell title={SOFTWARE_DETAIL_TITLE} errorMessage="Couldn't load this software.">
      <SoftwareDetailView softwareId={softwareId} loading={gate === 'loading'} />
    </SoftwarePageShell>
  );
}
