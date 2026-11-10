'use client';

import { LoadingWhen } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { notFound, useSearchParams } from 'next/navigation';
import { TenantPageShell } from '../components/shared/tenant-page-shell';
import { useTenantManagementGate, useTenantManagementV2Gate } from '../components/shared/use-tenant-management-gate';
import { ConnectTenantView } from '../components/tenant-new/connect-tenant-view';
import { NewTenantView } from '../components/tenant-new/new-tenant-view';
import { ConnectTenantViewV1 } from '../components/v1/tenant-new/connect-tenant-view-v1';
import { NewTenantViewV1 } from '../components/v1/tenant-new/new-tenant-view-v1';

export default function NewTenantPage() {
  const gate = useTenantManagementGate();
  const v2 = useTenantManagementV2Gate();
  // Set once Generate has created the record: the page is then its connect step, and a reload or Back resumes it.
  const connectionId = useSearchParams().get('id');
  if (gate === 'off') {
    notFound();
  }
  const on = v2 === 'on';
  return (
    <TenantPageShell
      title="New Tenant Integration"
      errorMessage="Couldn't load the connection form."
      resetKey={connectionId ?? undefined}
    >
      {/* The flag may not be read as "no" before it is known: until then the view draws in a loading scope, where
          it locks its controls and fetches nothing. */}
      <LoadingWhen loading={gate === 'loading' || v2 === 'loading'}>
        {connectionId ? (
          // Keyed by id: another record is another form.
          on ? (
            <ConnectTenantView key={connectionId} id={connectionId} />
          ) : (
            <ConnectTenantViewV1 key={connectionId} id={connectionId} />
          )
        ) : on ? (
          <NewTenantView />
        ) : (
          <NewTenantViewV1 />
        )}
      </LoadingWhen>
    </TenantPageShell>
  );
}
