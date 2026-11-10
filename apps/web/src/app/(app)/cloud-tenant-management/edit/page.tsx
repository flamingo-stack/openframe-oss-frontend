'use client';

import { LoadingWhen } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { notFound } from 'next/navigation';
import { useRequiredIdParam } from '@/app/hooks/use-required-id-param';
import { routes } from '@/lib/routes';
import { TenantPageShell } from '../components/shared/tenant-page-shell';
import { useTenantManagementGate, useTenantManagementV2Gate } from '../components/shared/use-tenant-management-gate';
import { EditTenantView } from '../components/tenant-edit/edit-tenant-view';
import { EditTenantViewV1 } from '../components/v1/tenant-edit/edit-tenant-view-v1';

export default function EditTenantPage() {
  const gate = useTenantManagementGate();
  const v2 = useTenantManagementV2Gate();
  const id = useRequiredIdParam(routes.cloudTenantManagement.list, routes.cloudTenantManagement.new());
  if (gate === 'off') {
    notFound();
  }
  if (!id) {
    return null;
  }
  return (
    <TenantPageShell title="Edit Tenant Integration" errorMessage="Couldn't load this tenant." resetKey={id}>
      {/* The flag may not be read as "no" before it is known: until then the view draws in a loading scope, where
          it locks its controls and fetches nothing. Keyed by id: a hop from tenant A to B would otherwise keep A's
          form state. */}
      <LoadingWhen loading={gate === 'loading' || v2 === 'loading'}>
        {v2 === 'on' ? <EditTenantView key={id} id={id} /> : <EditTenantViewV1 key={id} id={id} />}
      </LoadingWhen>
    </TenantPageShell>
  );
}
