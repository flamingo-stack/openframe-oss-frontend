'use client';

import { useMemo } from 'react';
import { useTenantManagementV2Gate } from '@/app/(app)/cloud-tenant-management/components/shared/use-tenant-management-gate';
import { DevicesPanel } from '@/app/components/shared';
import { routes } from '@/lib/routes';

interface CustomerDevicesTabProps {
  organizationId: string;
}

export function CustomerDevicesTab({ organizationId }: CustomerDevicesTabProps) {
  const lockedFilters = useMemo(() => ({ organizationIds: [organizationId] }), [organizationId]);
  // The per-customer archive came with Tenant Management Phase 2's review, so it ships with its flag.
  const archiveHref = useTenantManagementV2Gate() === 'on' ? routes.devices.archive({ organizationId }) : undefined;

  return (
    <DevicesPanel
      embedded
      addDeviceHref={routes.devices.new({ organizationId })}
      // The Status funnel never offers DELETED, so this is the only way to the customer's deleted devices.
      archiveHref={archiveHref}
      lockedFilters={lockedFilters}
      hideColumns={['organization']}
      hideFilters={['organization']}
    />
  );
}
