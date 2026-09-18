'use client';

import { notFound } from 'next/navigation';
import { ListPageSkeleton } from '@/app/components/shared';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { routes } from '@/lib/routes';
import { CONNECT_TENANT_ACTION, TenantListView } from './components/tenant-list-view';
import { TENANTS_TABLE_COLUMNS } from './components/tenants-table-columns';
import { useTenantManagementGate } from './hooks/use-tenant-management-gate';

/** The header action, inert, so the loading page is the same shape as the loaded one. */
const SKELETON_ACTIONS = [{ ...CONNECT_TENANT_ACTION, disabled: true }];

export default function TenantManagementPage() {
  const gate = useTenantManagementGate();
  const handleBack = useSafeBack(routes.settings.root());
  // A definitive "off" is a section the tenant does not have; "loading" is not
  // an answer yet and must never 404 (`notFound()` throws and cannot be undone).
  if (gate === 'off') {
    notFound();
  }
  if (gate === 'loading') {
    return (
      <ListPageSkeleton
        title="Tenant Management"
        backButton={{ label: 'Back', onClick: handleBack }}
        actions={SKELETON_ACTIONS}
        columns={TENANTS_TABLE_COLUMNS}
      />
    );
  }
  return <TenantListView />;
}
