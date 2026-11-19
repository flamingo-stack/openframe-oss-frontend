'use client';

import { DEVICE_STATUS } from '@flamingo-stack/openframe-frontend-core/components/features';
import { BoxArchiveIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { LoadingWhen } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import { useTenantManagementV2Gate } from '@/app/(app)/cloud-tenant-management/components/shared/use-tenant-management-gate';
import { DevicesPanel, EmptyState, NO_ITEMS } from '@/app/components/shared';
import { DEVICES_ARCHIVE_TABLE_SETTINGS } from '@/app/components/shared/devices-panel/devices-table-settings';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { tableLayoutFor, useTableGridGate } from '@/app/hooks/use-table-layout';
import { routes } from '@/lib/routes';

// The archive is the read-only history of deleted devices. DELETED is the
// terminal status a delete ends in; ARCHIVED is kept for legacy records created
// before the archive action was removed (they can no longer be restored either).
const ARCHIVE_STATUSES = [DEVICE_STATUS.DELETED, DEVICE_STATUS.ARCHIVED];

const ORGANIZATION = ['organization'];

export default function ArchivedDevices() {
  // One customer's archive when opened from its Devices tab: the customer column and funnel go, as they do there. That
  // tab links here only with `tenant-management-v2` on, so without it the address is ignored, as main ignores it.
  const requestedOrganizationId = useSearchParams().get('organizationId');
  const organizationId = useTenantManagementV2Gate() === 'on' ? requestedOrganizationId : null;
  const handleBack = useSafeBack(
    organizationId ? routes.customers.details(organizationId, { tab: 'devices' }) : routes.devices.list,
  );
  const lockedFilters = useMemo(
    () => ({ statuses: ARCHIVE_STATUSES, ...(organizationId && { organizationIds: [organizationId] }) }),
    [organizationId],
  );
  // The new grid table, behind the app's one table flag; card rows while it is off. While the flag is read the panel
  // draws its loading form, so the table never draws one layout and swaps to the other.
  const tableGate = useTableGridGate();

  return (
    <LoadingWhen loading={tableGate === 'loading'}>
      <DevicesPanel
        tableLayout={tableLayoutFor(tableGate)}
        tableSettings={DEVICES_ARCHIVE_TABLE_SETTINGS}
        title="Devices Archive"
        backButton={{ label: organizationId ? 'Back to Customer' : 'Back to Devices', onClick: handleBack }}
        className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
        lockedFilters={lockedFilters}
        defaultStatuses={NO_ITEMS}
        hideColumns={organizationId ? ORGANIZATION : undefined}
        hideFilters={organizationId ? ['status', ...ORGANIZATION] : ['status']}
        withoutDirectory
        showAddDevice={false}
        readOnlyRows
        emptyMessage="No archived devices."
        emptyState={
          <EmptyState
            icon={<BoxArchiveIcon />}
            title="No archived devices"
            description="Devices you delete will appear here"
          />
        }
      />
    </LoadingWhen>
  );
}
