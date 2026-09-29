'use client';

import { notFound } from 'next/navigation';
import { useRequiredIdParam } from '@/app/hooks/use-required-id-param';
import { routes } from '@/lib/routes';
import { TenantPageShell } from '../components/shared/tenant-page-shell';
import { useTenantManagementGate } from '../components/shared/use-tenant-management-gate';
import { TenantFormSkeleton } from '../components/tenant-form/tenant-form-skeleton';
import { ReconnectTenantView } from '../components/tenant-reconnect/reconnect-tenant-view';

export default function ReconnectTenantPage() {
  const gate = useTenantManagementGate();
  const id = useRequiredIdParam(routes.cloudTenantManagement.list, routes.cloudTenantManagement.new());
  if (gate === 'off') {
    notFound();
  }
  if (!id) {
    return null;
  }
  return (
    <TenantPageShell title="Reconnect Tenant Integration" errorMessage="Couldn't load this tenant." resetKey={id}>
      {gate === 'loading' ? (
        <TenantFormSkeleton variant="reconnect" />
      ) : (
        // Keyed by id: the mint guard and the probe verdict belong to one tenant.
        <ReconnectTenantView key={id} id={id} />
      )}
    </TenantPageShell>
  );
}
