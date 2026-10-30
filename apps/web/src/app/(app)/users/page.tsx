'use client';

import { notFound } from 'next/navigation';
import { TenantPageShell } from '../cloud-tenant-management/components/shared/tenant-page-shell';
import { useTenantManagementGate } from '../cloud-tenant-management/components/shared/use-tenant-management-gate';
import { UsersView } from './components/users-list/users-view';

export default function UsersPage() {
  // The directory users come with Cloud Tenant Management: the same flag, so the same gate.
  const gate = useTenantManagementGate();
  // A definitive "off" is a section the tenant does not have; "loading" is not an answer yet and must never 404.
  if (gate === 'off') {
    notFound();
  }
  return (
    <TenantPageShell title="Users" errorMessage="Couldn't load the users.">
      <UsersView loading={gate === 'loading'} />
    </TenantPageShell>
  );
}
