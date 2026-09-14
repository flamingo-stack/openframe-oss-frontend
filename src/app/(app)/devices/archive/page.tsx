'use client';

import { BoxArchiveIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { DevicesPanel, EmptyState } from '@/app/components/shared';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { routes } from '@/lib/routes';
import { DEVICE_STATUS } from '../constants/device-statuses';

// The archive is the read-only history of deleted devices. DELETED is the
// terminal status a delete ends in; ARCHIVED is kept for legacy records created
// before the archive action was removed (they can no longer be restored either).
const ARCHIVE_FILTERS = { statuses: [DEVICE_STATUS.DELETED, DEVICE_STATUS.ARCHIVED] };
// Module-level so the prop keeps a stable identity across renders.
const NO_DEFAULT_STATUSES: string[] = [];

export default function ArchivedDevices() {
  const handleBack = useSafeBack(routes.devices.list);

  return (
    <DevicesPanel
      title="Devices Archive"
      backButton={{ label: 'Back to Devices', onClick: handleBack }}
      className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
      lockedFilters={ARCHIVE_FILTERS}
      defaultStatuses={NO_DEFAULT_STATUSES}
      hideFilters={['status']}
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
  );
}
