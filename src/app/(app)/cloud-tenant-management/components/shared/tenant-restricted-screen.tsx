'use client';

import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { LockedScreen } from '@/app/components/shared/locked-screen';
import { routes } from '@/lib/routes';

/**
 * Shown in place of the New / Edit / Reconnect pages to anyone whose role cannot open
 * them — owners and admins can, see `use-workspace-admin-gate.ts` — INSTEAD of the 404
 * a closed route returns, for the reason `billing-restricted-screen.tsx` gives: the
 * section exists and the list shows it, the write pages are simply someone else's to
 * open, and a bookmark or a shared link is the only way here.
 */
export function TenantRestrictedScreen() {
  return (
    <LockedScreen
      title="Cloud Tenant Management is restricted"
      description="Connecting, editing and reconnecting a tenant changes what OpenFrame is allowed to read from a customer's directory, so only the workspace owner and admins can do it. Contact one of them if a tenant needs to change."
      actions={
        <Button variant="outline" href={routes.cloudTenantManagement.list}>
          Back to Integrations
        </Button>
      }
    />
  );
}
