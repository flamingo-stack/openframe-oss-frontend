'use client';

import { notFound, useSearchParams } from 'next/navigation';
import { useWorkspaceAdminGate } from '@/app/hooks/use-workspace-admin-gate';
import { TenantPageShell } from '../components/shared/tenant-page-shell';
import { TenantRestrictedScreen } from '../components/shared/tenant-restricted-screen';
import { useTenantManagementGate } from '../components/shared/use-tenant-management-gate';
import { TenantFormSkeleton } from '../components/tenant-form/tenant-form-skeleton';
import { ConnectTenantView } from '../components/tenant-new/connect-tenant-view';
import { NewTenantView } from '../components/tenant-new/new-tenant-view';

export default function NewTenantPage() {
  const gate = useTenantManagementGate();
  const access = useWorkspaceAdminGate();
  // Set once Generate has created the record: the page is then its connect step, and a reload or Back resumes it.
  const connectionId = useSearchParams().get('id');
  if (gate === 'off') {
    notFound();
  }
  if (gate === 'on' && access === 'denied') {
    return <TenantRestrictedScreen />;
  }
  return (
    <TenantPageShell
      title="New Tenant Integration"
      errorMessage="Couldn't load the connection form."
      resetKey={connectionId ?? undefined}
    >
      {/* Neither the flag nor the role may be read as "no" before it is known. */}
      {gate === 'loading' || access === 'loading' ? (
        <TenantFormSkeleton variant={connectionId ? 'connect' : 'new'} />
      ) : connectionId ? (
        // Keyed by id: another record is another form.
        <ConnectTenantView key={connectionId} id={connectionId} />
      ) : (
        <NewTenantView />
      )}
    </TenantPageShell>
  );
}
