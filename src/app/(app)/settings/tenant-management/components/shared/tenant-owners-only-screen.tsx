'use client';

import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { LockedScreen } from '@/app/components/shared/locked-screen';
import { routes } from '@/lib/routes';

/**
 * Shown in place of the New / Edit / Reconnect pages to anyone who is not a
 * workspace owner — INSTEAD of the 404 a closed route returns,
 * for the reason `billing-restricted-screen.tsx` gives: the section exists and
 * the list shows it, the write pages are simply someone else's to open, and a
 * bookmark or a shared link is the only way here.
 */
export function TenantOwnersOnlyScreen() {
  return (
    <LockedScreen
      title="Owners only"
      description="Connecting, editing and reconnecting a tenant changes what OpenFrame is allowed to read from a customer's directory, so only the workspace owner can do it. Contact them if a tenant needs to change."
      actions={
        <Button variant="outline" href={routes.settings.tenantManagement}>
          Back to Tenant Management
        </Button>
      }
    />
  );
}
