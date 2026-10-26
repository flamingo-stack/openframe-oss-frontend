'use client';

import { LoadingWhen } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { notFound } from 'next/navigation';
import { useRequiredIdParam } from '@/app/hooks/use-required-id-param';
import { routes } from '@/lib/routes';
import { TenantPageShell } from '../components/shared/tenant-page-shell';
import { useTenantManagementGate } from '../components/shared/use-tenant-management-gate';
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
      {/* Until the flag is known the view draws in a loading scope and reads nothing. Keyed by id: the mint guard
          and the probe verdict belong to one tenant. */}
      <LoadingWhen loading={gate === 'loading'}>
        <ReconnectTenantView key={id} id={id} />
      </LoadingWhen>
    </TenantPageShell>
  );
}
