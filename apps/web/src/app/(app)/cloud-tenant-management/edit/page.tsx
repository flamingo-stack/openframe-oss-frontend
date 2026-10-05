'use client';

import { notFound } from 'next/navigation';
import { useRequiredIdParam } from '@/app/hooks/use-required-id-param';
import { routes } from '@/lib/routes';
import { TenantPageShell } from '../components/shared/tenant-page-shell';
import { useTenantManagementGate } from '../components/shared/use-tenant-management-gate';
import { EditTenantView } from '../components/tenant-edit/edit-tenant-view';
import { TenantFormSkeleton } from '../components/tenant-form/tenant-form-skeleton';

export default function EditTenantPage() {
  const gate = useTenantManagementGate();
  const id = useRequiredIdParam(routes.cloudTenantManagement.list, routes.cloudTenantManagement.new());
  if (gate === 'off') {
    notFound();
  }
  if (!id) {
    return null;
  }
  return (
    <TenantPageShell title="Edit Tenant Integration" errorMessage="Couldn't load this tenant." resetKey={id}>
      {gate === 'loading' ? (
        <TenantFormSkeleton variant="edit" />
      ) : (
        // Keyed by id: a hop from tenant A to B would otherwise keep A's form state.
        <EditTenantView key={id} id={id} />
      )}
    </TenantPageShell>
  );
}
