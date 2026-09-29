'use client';

import { notFound } from 'next/navigation';
import { useRequiredIdParam } from '@/app/hooks/use-required-id-param';
import { useWorkspaceAdminGate } from '@/app/hooks/use-workspace-admin-gate';
import { routes } from '@/lib/routes';
import { TenantPageShell } from '../components/shared/tenant-page-shell';
import { TenantRestrictedScreen } from '../components/shared/tenant-restricted-screen';
import { useTenantManagementGate } from '../components/shared/use-tenant-management-gate';
import { TenantFormSkeleton } from '../components/tenant-form/tenant-form-skeleton';
import { ReconnectTenantView } from '../components/tenant-reconnect/reconnect-tenant-view';

export default function ReconnectTenantPage() {
  const gate = useTenantManagementGate();
  const access = useWorkspaceAdminGate();
  const id = useRequiredIdParam(routes.cloudTenantManagement.list, routes.cloudTenantManagement.new());
  if (gate === 'off') {
    notFound();
  }
  if (!id) {
    return null;
  }
  if (gate === 'on' && access === 'denied') {
    return <TenantRestrictedScreen />;
  }
  return (
    <TenantPageShell title="Reconnect Tenant Integration" errorMessage="Couldn't load this tenant." resetKey={id}>
      {gate === 'loading' || access === 'loading' ? (
        <TenantFormSkeleton variant="reconnect" />
      ) : (
        // Keyed by id: the mint guard and the probe verdict belong to one tenant.
        <ReconnectTenantView key={id} id={id} />
      )}
    </TenantPageShell>
  );
}
