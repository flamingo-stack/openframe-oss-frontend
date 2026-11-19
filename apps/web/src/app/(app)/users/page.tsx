'use client';

import { notFound } from 'next/navigation';
import { TableLayoutScope } from '@/app/components/shared/table-layout-scope';
import { TenantPageShell } from '../cloud-tenant-management/components/shared/tenant-page-shell';
import { useTenantManagementV2Gate } from '../cloud-tenant-management/components/shared/use-tenant-management-gate';
import { UsersView } from './components/users-list/users-view';

export default function UsersPage() {
  const gate = useTenantManagementV2Gate();
  // A definitive "off" is a section the tenant does not have; "loading" is not an answer yet and must never 404.
  if (gate === 'off') {
    notFound();
  }
  return (
    <TenantPageShell title="Users" errorMessage="Couldn't load the users.">
      {/* The list is the page's content: in the grid layout its table is the page's scroll area. */}
      <TableLayoutScope fill>
        <UsersView loading={gate === 'loading'} />
      </TableLayoutScope>
    </TenantPageShell>
  );
}
