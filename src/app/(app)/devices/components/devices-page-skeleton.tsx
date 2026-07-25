'use client';

import { BoxArchiveIcon, PlusCircleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { type PageActionButton, PageLayout } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { SearchBarSkeleton } from '@/app/components/shared';
import { DevicesTableBody } from './devices-table-columns';

/**
 * Route-level skeleton for the devices list (`/devices`, `/devices/archive`).
 *
 * Mirrors `DevicesPanel`'s loading state by rendering the REAL pieces it uses:
 * its `PageLayout` header with the same (disabled) action buttons, the filter
 * toolbar row, and `DevicesTableBody` in `isLoading` mode — so the column set
 * comes from the real table definition and can't drift.
 */

const EMPTY_DEVICES: never[] = [];

const LIST_ACTIONS: PageActionButton[] = [
  {
    label: 'Archive',
    variant: 'outline',
    disabled: true,
    icon: <BoxArchiveIcon className="w-5 h-5 text-ods-text-secondary" />,
  },
  {
    label: 'Add Device',
    variant: 'outline',
    disabled: true,
    icon: <PlusCircleIcon className="w-5 h-5 text-ods-text-secondary" />,
  },
];

const noop = () => {};

export function DevicesPageSkeleton({ archived = false }: { archived?: boolean }) {
  return (
    <PageLayout
      title={archived ? 'Archived Devices' : 'Devices'}
      backButton={archived ? { label: 'Back', onClick: noop } : undefined}
      actions={archived ? undefined : LIST_ACTIONS}
      actionsVariant="icon-buttons"
      className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
      contentClassName="flex flex-col"
    >
      <div>
        <SearchBarSkeleton />
        <DevicesTableBody devices={EMPTY_DEVICES} isLoading emptyMessage="" skeletonRows={10} deviceFilters={null} />
      </div>
    </PageLayout>
  );
}
