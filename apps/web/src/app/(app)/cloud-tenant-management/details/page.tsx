'use client';

import { notFound } from 'next/navigation';
import { useRequiredIdParam } from '@/app/hooks/use-required-id-param';
import { routes } from '@/lib/routes';
import { TenantPageShell } from '../components/shared/tenant-page-shell';
import { useTenantManagementGate, useTenantManagementV2Gate } from '../components/shared/use-tenant-management-gate';
import { TENANT_DETAIL_TITLE } from '../components/tenant-detail/tenant-detail-title';
import { TenantDetailView } from '../components/tenant-detail/tenant-detail-view';
import { TenantDetailViewV1 } from '../components/v1/tenant-detail/tenant-detail-view-v1';

export default function TenantDetailsPage() {
  const gate = useTenantManagementGate();
  const v2 = useTenantManagementV2Gate();
  // `?id=` missing → the list; `?id=new` → the create page. Null while redirecting.
  const id = useRequiredIdParam(routes.cloudTenantManagement.list, routes.cloudTenantManagement.new());
  if (gate === 'off') {
    notFound();
  }
  if (!id) {
    return null;
  }
  const loading = gate === 'loading' || v2 === 'loading';
  return (
    <TenantPageShell title={TENANT_DETAIL_TITLE} errorMessage="Couldn't load this tenant." resetKey={id}>
      {/* Keyed by id: the router reuses this segment when only `?id=` changes. */}
      {v2 === 'on' ? (
        <TenantDetailView key={id} id={id} loading={loading} />
      ) : (
        <TenantDetailViewV1 key={id} id={id} loading={loading} />
      )}
    </TenantPageShell>
  );
}
