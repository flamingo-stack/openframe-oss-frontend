'use client';

import { Refresh02HrIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { type PageActionButton, PageLayout } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { SearchBarSkeleton } from '@/app/components/shared';
import { LogsTableSkeleton } from './logs-table-skeleton';

/**
 * Route-level skeleton for `/logs-page` — the real `PageLayout` chrome
 * `LogsTable` renders (title + Refresh button), its search toolbar and the
 * table's own `LogsTableSkeleton`, inside the padding the page applies.
 */

const SKELETON_ACTIONS: PageActionButton[] = [
  {
    label: 'Refresh',
    variant: 'outline',
    disabled: true,
    icon: <Refresh02HrIcon size={24} className="text-ods-text-secondary" />,
  },
];

export function LogsPageSkeleton() {
  return (
    <div className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]">
      <PageLayout title="Logs" actions={SKELETON_ACTIONS}>
        <SearchBarSkeleton />
        <LogsTableSkeleton />
      </PageLayout>
    </div>
  );
}
