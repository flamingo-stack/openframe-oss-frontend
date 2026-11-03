'use client';

import { useMemo } from 'react';
import { DevicesPanel } from '@/app/components/shared';
import { routes } from '@/lib/routes';

interface CustomerDevicesTabProps {
  organizationId: string;
}

export function CustomerDevicesTab({ organizationId }: CustomerDevicesTabProps) {
  const lockedFilters = useMemo(() => ({ organizationIds: [organizationId] }), [organizationId]);

  return (
    <DevicesPanel
      embedded
      addDeviceHref={routes.devices.new({ organizationId })}
      // The Status funnel never offers DELETED, so this is the only way to the customer's deleted devices.
      archiveHref={routes.devices.archive({ organizationId })}
      lockedFilters={lockedFilters}
      hideColumns={['organization']}
      hideFilters={['organization']}
    />
  );
}
