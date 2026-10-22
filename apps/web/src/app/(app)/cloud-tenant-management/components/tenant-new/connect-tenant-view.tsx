'use client';

import { LiveSuspense } from '@/app/components/shared/live-suspense';
import { ConnectTenantContent } from './connect-tenant-content';

/** `/cloud-tenant-management/new?id=`: the record Generate created, its consent hand-off below. */
export function ConnectTenantView({ id }: { id: string }) {
  // Live while the record loads: Back works, and the pending form locks its own fields and Save.
  return (
    <LiveSuspense label="Loading tenant form" view={<ConnectTenantContent id={id} />}>
      <ConnectTenantContent id={id} />
    </LiveSuspense>
  );
}
