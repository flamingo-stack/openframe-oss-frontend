'use client';

import { notFound } from 'next/navigation';
import { useOwnerGate } from '@/app/hooks/use-owner-gate';
import { useRequiredIdParam } from '@/app/hooks/use-required-id-param';
import { routes } from '@/lib/routes';
import { EditTenantView } from '../components/edit-tenant-view';
import { TenantOwnersOnlyScreen } from '../components/tenant-owners-only-screen';
import { TenantFormSkeleton } from '../components/tenant-page-skeletons';
import { useTenantManagementGate } from '../hooks/use-tenant-management-gate';

export default function EditTenantPage() {
  const gate = useTenantManagementGate();
  const ownerGate = useOwnerGate();
  const id = useRequiredIdParam(routes.settings.tenantManagement, routes.settings.tenantNew);
  if (gate === 'off') {
    notFound();
  }
  if (!id) {
    return null;
  }
  if (gate === 'loading' || ownerGate === 'loading') {
    return <TenantFormSkeleton variant="edit" />;
  }
  if (ownerGate === 'not-owner') {
    return <TenantOwnersOnlyScreen />;
  }
  return <EditTenantView id={id} />;
}
