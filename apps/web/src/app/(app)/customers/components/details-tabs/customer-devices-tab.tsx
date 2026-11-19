'use client';

import { LoadingWhen } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useMemo } from 'react';
import { useTenantManagementV2Gate } from '@/app/(app)/cloud-tenant-management/components/shared/use-tenant-management-gate';
import { DevicesPanel } from '@/app/components/shared';
import { CUSTOMER_DEVICES_TABLE_SETTINGS } from '@/app/components/shared/devices-panel/devices-table-settings';
import { tableLayoutFor, useTableGridGate } from '@/app/hooks/use-table-layout';
import { routes } from '@/lib/routes';

interface CustomerDevicesTabProps {
  organizationId: string;
}

export function CustomerDevicesTab({ organizationId }: CustomerDevicesTabProps) {
  const lockedFilters = useMemo(() => ({ organizationIds: [organizationId] }), [organizationId]);
  // The per-customer archive came with Tenant Management Phase 2's review, so it ships with its flag.
  const archiveHref = useTenantManagementV2Gate() === 'on' ? routes.devices.archive({ organizationId }) : undefined;

  // The new grid table, behind the app's one table flag; card rows while it is off. While the flag is read the panel
  // draws its loading form, so the table never draws one layout and swaps to the other.
  const tableGate = useTableGridGate();

  return (
    <LoadingWhen loading={tableGate === 'loading'}>
      <DevicesPanel
        embedded
        // Embedded in the customer's page: the grid table keeps its natural height (the page scrolls), under its own key.
        tableLayout={tableLayoutFor(tableGate)}
        tableSettings={CUSTOMER_DEVICES_TABLE_SETTINGS}
        addDeviceHref={routes.devices.new({ organizationId })}
        // The Status funnel never offers DELETED, so this is the only way to the customer's deleted devices.
        archiveHref={archiveHref}
        lockedFilters={lockedFilters}
        hideColumns={['organization']}
        hideFilters={['organization']}
      />
    </LoadingWhen>
  );
}
