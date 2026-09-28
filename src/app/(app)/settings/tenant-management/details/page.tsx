'use client';

import { notFound } from 'next/navigation';
import { useRequiredIdParam } from '@/app/hooks/use-required-id-param';
import { routes } from '@/lib/routes';
import { TenantPageShell } from '../components/shared/tenant-page-shell';
import { useTenantManagementGate } from '../components/shared/use-tenant-management-gate';
import { TENANT_DETAIL_TITLE } from '../components/tenant-detail/tenant-detail-title';
import { TenantDetailView } from '../components/tenant-detail/tenant-detail-view';

export default function TenantDetailsPage() {
  const gate = useTenantManagementGate();
  // `?id=` missing → the list; `?id=new` → the create page. Null while redirecting.
  const id = useRequiredIdParam(routes.settings.tenantManagement, routes.settings.tenantNew());
  if (gate === 'off') {
    notFound();
  }
  if (!id) {
    return null;
  }
  return (
    <TenantPageShell title={TENANT_DETAIL_TITLE} errorMessage="Couldn't load this tenant." resetKey={id}>
      {/* Keyed by id: the router reuses this segment when only `?id=` changes. */}
      <TenantDetailView key={id} id={id} loading={gate === 'loading'} />
    </TenantPageShell>
  );
}
