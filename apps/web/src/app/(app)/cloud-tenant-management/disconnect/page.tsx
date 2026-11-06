'use client';

import { LoadingWhen } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { notFound } from 'next/navigation';
import { useRequiredIdParam } from '@/app/hooks/use-required-id-param';
import { routes } from '@/lib/routes';
import { TenantPageShell } from '../components/shared/tenant-page-shell';
import { useTenantManagementV2Gate } from '../components/shared/use-tenant-management-gate';
import { EndConnectionView } from '../components/tenant-end/end-connection-view';

export default function DisconnectTenantPage() {
  const gate = useTenantManagementV2Gate();
  const id = useRequiredIdParam(routes.cloudTenantManagement.list);
  if (gate === 'off') {
    notFound();
  }
  if (!id) {
    return null;
  }
  return (
    <TenantPageShell title="Disconnect Tenant" errorMessage="Couldn't load this tenant." resetKey={id}>
      <LoadingWhen loading={gate === 'loading'}>
        <EndConnectionView key={id} id={id} mode="disconnect" />
      </LoadingWhen>
    </TenantPageShell>
  );
}
