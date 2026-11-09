'use client';

import { notFound } from 'next/navigation';
import { TenantPageShell } from './components/shared/tenant-page-shell';
import { useTenantManagementGate, useTenantManagementV2Gate } from './components/shared/use-tenant-management-gate';
import { TenantListView } from './components/tenant-list/tenant-list-view';
import { TenantListViewV1 } from './components/v1/tenant-list/tenant-list-view-v1';

export default function TenantManagementPage() {
  const gate = useTenantManagementGate();
  const v2 = useTenantManagementV2Gate();
  // A definitive "off" is a section the tenant does not have; "loading" is not an answer yet and must never 404.
  if (gate === 'off') {
    notFound();
  }
  const loading = gate === 'loading' || v2 === 'loading';
  return (
    <TenantPageShell title="Cloud Tenant Management" errorMessage="Couldn't load the tenants.">
      {v2 === 'on' ? <TenantListView loading={loading} /> : <TenantListViewV1 loading={loading} />}
    </TenantPageShell>
  );
}
