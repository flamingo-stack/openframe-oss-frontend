'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { ConnectTenantContent } from './connect-tenant-content';

/** `/cloud-tenant-management/new?id=`: the record Generate created, its consent hand-off below. */
export function ConnectTenantView({ id }: { id: string }) {
  return (
    <LoadingSuspense live label="Loading tenant form">
      <ConnectTenantContent id={id} />
    </LoadingSuspense>
  );
}
