'use client';

import { notFound } from 'next/navigation';
import { useRequiredIdParam } from '@/app/hooks/use-required-id-param';
import { routes } from '@/lib/routes';
import { TenantDetailsView } from '../components/tenant-details-view';
import { TenantDetailsSkeleton } from '../components/tenant-page-skeletons';
import { useTenantManagementGate } from '../hooks/use-tenant-management-gate';

export default function TenantDetailsPage() {
  const gate = useTenantManagementGate();
  // `?id=` missing → the list; `?id=new` → the create page. Null while redirecting.
  const id = useRequiredIdParam(routes.settings.tenantManagement, routes.settings.tenantNew);
  if (gate === 'off') {
    notFound();
  }
  if (!id) {
    return null;
  }
  if (gate === 'loading') {
    return <TenantDetailsSkeleton />;
  }
  return <TenantDetailsView id={id} />;
}
