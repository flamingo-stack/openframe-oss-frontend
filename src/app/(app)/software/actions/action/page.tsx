'use client';

import { useRequiredIdParam } from '@/app/hooks/use-required-id-param';
import { routes } from '@/lib/routes';
import { SoftwareActionDetailView } from '../../components/action-detail/software-action-detail-view';
import { SOFTWARE_ACTION_DETAIL_TITLE } from '../../components/shared/software-action-copy';
import { SoftwarePageShell } from '../../components/shared/software-page-shell';

export default function SoftwareActionDetailsPage() {
  // A missing id is a truncated link, not a page: bounce to the list.
  const actionId = useRequiredIdParam(routes.software.actions);

  if (!actionId) return null;

  return (
    <SoftwarePageShell title={SOFTWARE_ACTION_DETAIL_TITLE} errorMessage="Couldn't load this run.">
      <SoftwareActionDetailView actionId={actionId} />
    </SoftwarePageShell>
  );
}
