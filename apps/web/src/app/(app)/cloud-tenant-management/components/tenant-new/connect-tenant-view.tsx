'use client';

import { ConnectTenantContent } from './connect-tenant-content';

/** `/cloud-tenant-management/new?id=`: the record Generate created, its consent hand-off below. */
export function ConnectTenantView({ id }: { id: string }) {
  return <ConnectTenantContent id={id} />;
}
