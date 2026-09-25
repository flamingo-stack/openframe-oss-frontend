'use client';

import { notFound } from 'next/navigation';
import { useOwnerGate } from '@/app/hooks/use-owner-gate';
import { TenantOwnersOnlyScreen } from '../components/shared/tenant-owners-only-screen';
import { TenantPageShell } from '../components/shared/tenant-page-shell';
import { useTenantManagementGate } from '../components/shared/use-tenant-management-gate';
import { TenantFormSkeleton } from '../components/tenant-form/tenant-form-skeleton';
import { NewTenantView } from '../components/tenant-new/new-tenant-view';

export default function NewTenantPage() {
  const gate = useTenantManagementGate();
  const ownerGate = useOwnerGate();
  if (gate === 'off') {
    notFound();
  }
  if (gate === 'on' && ownerGate === 'not-owner') {
    return <TenantOwnersOnlyScreen />;
  }
  return (
    <TenantPageShell title="New Tenant Integration" errorMessage="Couldn't load the connection form.">
      {/* Neither the flag nor the role may be read as "no" before it is known. */}
      {gate === 'loading' || ownerGate === 'loading' ? <TenantFormSkeleton variant="new" /> : <NewTenantView />}
    </TenantPageShell>
  );
}
