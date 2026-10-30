'use client';

import { notFound } from 'next/navigation';
import { useRequiredIdParam } from '@/app/hooks/use-required-id-param';
import { routes } from '@/lib/routes';
import { TenantPageShell } from '../../cloud-tenant-management/components/shared/tenant-page-shell';
import { useTenantManagementGate } from '../../cloud-tenant-management/components/shared/use-tenant-management-gate';
import { USER_DETAIL_TITLE } from '../components/user-detail/user-detail-header';
import { UserDetailView } from '../components/user-detail/user-detail-view';

export default function UserDetailsPage() {
  const gate = useTenantManagementGate();
  // `?id=` (an account id) missing → the list. Null while redirecting.
  const id = useRequiredIdParam(routes.users.list);
  if (gate === 'off') {
    notFound();
  }
  if (!id) {
    return null;
  }
  return (
    <TenantPageShell title={USER_DETAIL_TITLE} errorMessage="Couldn't load this user." resetKey={id}>
      {/* Keyed by id: the router reuses this segment when only `?id=` changes. */}
      <UserDetailView key={id} id={id} loading={gate === 'loading'} />
    </TenantPageShell>
  );
}
