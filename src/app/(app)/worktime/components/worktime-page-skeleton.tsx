'use client';

import { PlusCircleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons';
import { type PageActionButton, PageLayout, Skeleton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { WorkTimeTableSkeleton } from '@/app/components/shared/work-time-table';

/**
 * Route-level skeleton for `/worktime` — `WorktimeView`'s header plus the REAL
 * `WorkTimeTableSkeleton` (the stats row + entry table exactly as the table
 * renders them while its query is in flight) under the search/date-range row.
 */

const ACTIONS: PageActionButton[] = [
  { label: 'Add Work Time', variant: 'outline', disabled: true, icon: <PlusCircleIcon iconSize={20} whiteOverlay /> },
];

export function WorktimePageSkeleton() {
  return (
    <PageLayout
      title="Worktime"
      actions={ACTIONS}
      actionsVariant="primary-buttons"
      className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
    >
      <div className="flex flex-col gap-[var(--spacing-system-l)]">
        {/* Search input + date-range picker row (`md:w-[276px]` picker). */}
        <div className="flex flex-col gap-[var(--spacing-system-m)] md:flex-row md:items-start">
          <Skeleton className="h-12 w-full rounded-[6px] md:flex-1" />
          <Skeleton className="h-12 w-full rounded-[6px] md:w-[276px]" />
        </div>
        <WorkTimeTableSkeleton showEmployee showCustomer />
      </div>
    </PageLayout>
  );
}
