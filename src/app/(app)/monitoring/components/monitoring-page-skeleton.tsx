'use client';

import { PlusCircleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  DataTable,
  type PageActionButton,
  PageLayout,
  Skeleton,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { PoliciesTable, QueriesTable, SearchBarSkeleton, TabBarSkeleton } from '@/app/components/shared';

/**
 * Route-level skeleton for `/monitoring` — the tab bar plus the active tab's
 * own chrome. Both tabs reuse the REAL shared tables (`PoliciesTable` /
 * `QueriesTable`) in `isLoading` mode, so their column layout comes from the
 * table definitions rather than a copy.
 */

const TAB_WIDTHS = ['w-[130px]', 'w-[130px]'] as const;
const SUMMARY_CARD_KEYS = ['total', 'compliance', 'failed', 'updated'] as const;
const EMPTY_ROWS: never[] = [];

function addAction(label: string): PageActionButton[] {
  return [
    {
      label,
      variant: 'outline',
      disabled: true,
      icon: <PlusCircleIcon size={24} className="text-ods-text-secondary" />,
    },
  ];
}

const POLICY_ACTIONS = addAction('Add Policy');
const QUERY_ACTIONS = addAction('Add Query');

export function MonitoringPageSkeleton({ tab }: { tab?: string }) {
  const isQueries = tab === 'queries';

  return (
    <div className="flex w-full flex-col">
      <div className="px-[var(--spacing-system-l)]">
        <TabBarSkeleton widths={TAB_WIDTHS} />
      </div>
      <PageLayout
        title={isQueries ? 'Queries' : 'Policies'}
        actions={isQueries ? QUERY_ACTIONS : POLICY_ACTIONS}
        className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
      >
        {!isQueries && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* `DashboardInfoCard`'s own height — see the matching note in `policies.tsx`. */}
            {SUMMARY_CARD_KEYS.map(key => (
              <Skeleton key={key} className="h-16 w-full md:h-[104px]" />
            ))}
          </div>
        )}
        <div className="flex flex-col gap-[var(--spacing-system-l)]">
          <SearchBarSkeleton />
          {isQueries ? (
            <QueriesTable rows={EMPTY_ROWS} isLoading emptyMessage="" rightSlot={<DataTable.RowCount />} />
          ) : (
            <PoliciesTable rows={EMPTY_ROWS} isLoading emptyMessage="" rightSlot={<DataTable.RowCount />} />
          )}
        </div>
      </PageLayout>
    </div>
  );
}
