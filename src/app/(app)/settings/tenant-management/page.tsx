'use client';

import { notFound } from 'next/navigation';
import { TenantPageShell } from './components/shared/tenant-page-shell';
import { useTenantManagementGate } from './components/shared/use-tenant-management-gate';
import { TenantListView } from './components/tenant-list/tenant-list-view';

export default function TenantManagementPage() {
  const gate = useTenantManagementGate();
  // A definitive "off" is a section the tenant does not have; "loading" is not an answer yet and must never 404.
  if (gate === 'off') {
    notFound();
  }
  return (
    <TenantPageShell title="Tenant Management" errorMessage="Couldn't load the tenants.">
      <TenantListView loading={gate === 'loading'} />
    </TenantPageShell>
  );
}
