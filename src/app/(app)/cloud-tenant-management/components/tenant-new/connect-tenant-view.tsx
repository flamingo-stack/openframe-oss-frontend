'use client';

import { Suspense } from 'react';
import { TenantFormSkeleton } from '../tenant-form/tenant-form-skeleton';
import { ConnectTenantContent } from './connect-tenant-content';

/** `/cloud-tenant-management/new?id=`: the record Generate created, its consent hand-off below. */
export function ConnectTenantView({ id }: { id: string }) {
  return (
    <Suspense fallback={<TenantFormSkeleton variant="connect" />}>
      <ConnectTenantContent id={id} />
    </Suspense>
  );
}
