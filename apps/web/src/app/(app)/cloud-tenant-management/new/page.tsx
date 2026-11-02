'use client';

import { LoadingWhen } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { notFound, useSearchParams } from 'next/navigation';
import { TenantPageShell } from '../components/shared/tenant-page-shell';
import { useTenantManagementGate } from '../components/shared/use-tenant-management-gate';
import { ConnectTenantView } from '../components/tenant-new/connect-tenant-view';
import { NewTenantView } from '../components/tenant-new/new-tenant-view';

export default function NewTenantPage() {
  const gate = useTenantManagementGate();
  // Set once Generate has created the record: the page is then its connect step, and a reload or Back resumes it.
  const connectionId = useSearchParams().get('id');
  if (gate === 'off') {
    notFound();
  }
  return (
    <TenantPageShell
      title="New Tenant Integration"
      errorMessage="Couldn't load the connection form."
      resetKey={connectionId ?? undefined}
    >
      {/* The flag may not be read as "no" before it is known: until then the view draws in a loading scope, where
          it locks its controls and fetches nothing. */}
      <LoadingWhen loading={gate === 'loading'}>
        {connectionId ? (
          // Keyed by id: another record is another form.
          <ConnectTenantView key={connectionId} id={connectionId} />
        ) : (
          <NewTenantView />
        )}
      </LoadingWhen>
    </TenantPageShell>
  );
}
