'use client';

import { LoadingFallback } from '@flamingo-stack/openframe-frontend-core/components';
import {
  ExternalLinkIcon,
  Filter02Icon,
  SearchIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Button,
  type ColumnDef,
  DataTable,
  Input,
  PageLayout,
  useDataTable,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { skeletonColumnMeta } from '@/app/components/shared/table-column-layout';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { isBillingReadOnly, openBillingInBrowser } from '@/lib/billing-visibility';
import { routes } from '@/lib/routes';
import { BillingReadOnlyNotice, TestModeBanner } from '../shared/billing-section';
import { UsageStatCardSkeleton } from '../shared/usage-stat-card';
import { CurrentPlanSectionSkeleton } from './current-plan-section';
import { INVOICES_SKELETON_ROWS, INVOICES_TABLE_COLUMNS } from './invoices-table-layout';

const NO_INVOICES: never[] = [];

/** The invoices table's real columns and header, from the layout the live table reads. */
const INVOICE_SKELETON_COLUMNS: ColumnDef<never>[] = INVOICES_TABLE_COLUMNS.map(column => ({
  id: column.id,
  header: column.header ?? '',
  enableSorting: false,
  meta: skeletonColumnMeta(column),
}));

/**
 * `BillingUsageContent`'s own skeleton, for the ONE wait it cannot draw itself in: while its code downloads (it is a
 * `next/dynamic` import, so the builds that may not show payments never download it). Every other wait (the page's
 * gates, its query) is the content itself in a loading scope. Built from the same parts: the stat cards', Current
 * Plan's and the billing rows' own skeletons, and the invoices table's real columns with its skeleton rows.
 *
 * Used ONLY on the `loading: () =>` line of the dynamic import in `billing-usage-view.tsx`.
 */
export function BillingUsageContentSkeleton() {
  const handleBack = useSafeBack(routes.settings.root());
  const readOnly = isBillingReadOnly();
  const table = useDataTable<never>({
    data: NO_INVOICES,
    columns: INVOICE_SKELETON_COLUMNS,
    getRowId: () => '',
    enableSorting: false,
  });

  return (
    <LoadingFallback label="Loading billing and usage">
      <PageLayout
        title="Billing & Usage"
        className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
        backButton={{ label: 'Back to Settings', onClick: handleBack }}
        actionsVariant="menu-primary"
        // The read-only build's one header action, as the page states it before its subscription answers.
        actions={
          readOnly
            ? [
                {
                  label: 'Manage Billing',
                  icon: <ExternalLinkIcon className="h-6 w-6" />,
                  onClick: openBillingInBrowser,
                  variant: 'accent',
                },
              ]
            : undefined
        }
      >
        {readOnly && <BillingReadOnlyNotice />}
        <TestModeBanner />

        <div className="grid gap-[var(--spacing-system-m)] content-md:grid-cols-3">
          <UsageStatCardSkeleton title="Device Usage" />
          <UsageStatCardSkeleton title="Free AI Tokens" />
          <UsageStatCardSkeleton title="Paid AI Tokens" />
        </div>

        <div className="grid grid-cols-1 items-start gap-[var(--spacing-system-l)]">
          <CurrentPlanSectionSkeleton />
        </div>

        <div className="flex flex-col gap-[var(--spacing-system-l)]">
          <h2 className="text-ods-text-primary text-h2">Invoices History</h2>
          <div className="flex items-center gap-[var(--spacing-system-m)]">
            <div className="flex-1">
              <Input startAdornment={<SearchIcon />} placeholder="Search for Invoice" className="w-full" readOnly />
            </div>
            <Button
              variant="outline"
              size="icon"
              className="content-md:hidden"
              aria-label="Open filters"
              leftIcon={<Filter02Icon className="text-ods-text-primary" />}
            />
          </div>
          <DataTable table={table}>
            <DataTable.Header />
            <DataTable.Body loading skeletonRows={INVOICES_SKELETON_ROWS} />
          </DataTable>
        </div>
      </PageLayout>
    </LoadingFallback>
  );
}
