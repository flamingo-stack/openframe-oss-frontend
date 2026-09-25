'use client';

import { notFound } from 'next/navigation';
import { useOwnerGate } from '@/app/hooks/use-owner-gate';
import { useRequiredIdParam } from '@/app/hooks/use-required-id-param';
import { routes } from '@/lib/routes';
import { TenantOwnersOnlyScreen } from '../components/shared/tenant-owners-only-screen';
import { TenantPageShell } from '../components/shared/tenant-page-shell';
import { useTenantManagementGate } from '../components/shared/use-tenant-management-gate';
import { TenantFormSkeleton } from '../components/tenant-form/tenant-form-skeleton';
import { ReconnectTenantView } from '../components/tenant-reconnect/reconnect-tenant-view';

export default function ReconnectTenantPage() {
  const gate = useTenantManagementGate();
  const ownerGate = useOwnerGate();
  const id = useRequiredIdParam(routes.settings.tenantManagement, routes.settings.tenantNew);
  if (gate === 'off') {
    notFound();
  }
  if (!id) {
    return null;
  }
  if (gate === 'on' && ownerGate === 'not-owner') {
    return <TenantOwnersOnlyScreen />;
  }
  return (
    <TenantPageShell title="Reconnect Tenant Integration" errorMessage="Couldn't load this tenant." resetKey={id}>
      {gate === 'loading' || ownerGate === 'loading' ? (
        <TenantFormSkeleton variant="reconnect" />
      ) : (
        // Keyed by id: the mint guard and the probe verdict belong to one tenant.
        <ReconnectTenantView key={id} id={id} />
      )}
    </TenantPageShell>
  );
}
