'use client';

import { LoadingFallback } from '@flamingo-stack/openframe-frontend-core/components';
import { Suspense } from 'react';
import { ConnectTenantContent } from './connect-tenant-content';

/** `/cloud-tenant-management/new?id=`: the record Generate created, its consent hand-off below. */
export function ConnectTenantView({ id }: { id: string }) {
  return (
    <Suspense
      fallback={
        <LoadingFallback label="Loading tenant form">
          <ConnectTenantContent id={id} />
        </LoadingFallback>
      }
    >
      <ConnectTenantContent id={id} />
    </Suspense>
  );
}
