'use client';

import { notFound } from 'next/navigation';
import { useOwnerGate } from '@/app/hooks/use-owner-gate';
import { NewTenantView } from '../components/new-tenant-view';
import { TenantOwnersOnlyScreen } from '../components/tenant-owners-only-screen';
import { TenantFormSkeleton } from '../components/tenant-page-skeletons';
import { useTenantManagementGate } from '../hooks/use-tenant-management-gate';

export default function NewTenantPage() {
  const gate = useTenantManagementGate();
  const ownerGate = useOwnerGate();
  if (gate === 'off') {
    notFound();
  }
  // Both answers are tri-state: neither the flag nor the role may be read as
  // "no" before it is known, so the real chrome waits for both.
  if (gate === 'loading' || ownerGate === 'loading') {
    return <TenantFormSkeleton variant="new" />;
  }
  if (ownerGate === 'not-owner') {
    return <TenantOwnersOnlyScreen />;
  }
  return <NewTenantView />;
}
