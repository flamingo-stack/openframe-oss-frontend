'use client';
// Main's apps/web/src/app/(app)/cloud-tenant-management/components/tenant-new/connect-tenant-view.tsx, rendered while tenant-management-v2 is off. Deleted with the flag.

import { ConnectTenantContentV1 } from './connect-tenant-content-v1';

/** `/cloud-tenant-management/new?id=`: the record Generate created, its consent hand-off below. */
export function ConnectTenantViewV1({ id }: { id: string }) {
  return <ConnectTenantContentV1 id={id} />;
}
