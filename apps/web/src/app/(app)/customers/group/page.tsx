'use client';

import { notFound, useSearchParams } from 'next/navigation';
import { TenantPageShell } from '@/app/(app)/cloud-tenant-management/components/shared/tenant-page-shell';
import { useTenantManagementGate } from '@/app/(app)/cloud-tenant-management/components/shared/use-tenant-management-gate';
import { GROUP_DETAIL_TITLE } from '@/app/(app)/users/components/group-detail/group-detail-title';
import { GroupDetailView } from '@/app/(app)/users/components/group-detail/group-detail-view';
import { useRequiredIdParam } from '@/app/hooks/use-required-id-param';
import { routes } from '@/lib/routes';

export default function CustomerGroupPage() {
  const gate = useTenantManagementGate();
  const customerId = useSearchParams().get('customerId') ?? undefined;
  // `?id=` missing → the customer it came from, else the customers list. Null while redirecting.
  const id = useRequiredIdParam(customerId ? routes.customers.details(customerId) : routes.customers.list());
  if (gate === 'off') {
    notFound();
  }
  if (!id) {
    return null;
  }
  return (
    <TenantPageShell title={GROUP_DETAIL_TITLE} errorMessage="Couldn't load this group." resetKey={id}>
      {/* Keyed by id: the router reuses this segment when only `?id=` changes (a subgroup opening). */}
      <GroupDetailView key={id} id={id} customerId={customerId} loading={gate === 'loading'} />
    </TenantPageShell>
  );
}
