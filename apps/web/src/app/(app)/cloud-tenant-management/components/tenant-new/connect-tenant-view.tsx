'use client';

import { LiveSuspense } from '@/app/components/shared/live-suspense';
import { ConnectTenantContent } from './connect-tenant-content';

/** `/cloud-tenant-management/new?id=`: the record Generate created, its consent hand-off below. */
export function ConnectTenantView({ id }: { id: string }) {
  return (
    <LiveSuspense label="Loading tenant form">
      <ConnectTenantContent id={id} />
    </LiveSuspense>
  );
}
