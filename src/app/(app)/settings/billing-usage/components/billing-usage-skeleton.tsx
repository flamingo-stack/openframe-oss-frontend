'use client';

import { SearchIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Input, PageLayout, Skeleton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { InlineSkeleton, TableSkeleton } from '@/app/components/shared';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { isBillingHidden } from '@/lib/billing-visibility';
import { routes } from '@/lib/routes';
import { INVOICES_TABLE_COLUMNS } from '../lib/invoices-table-columns';
import { BillingRow, SectionBlock, TestModeBanner } from './billing-section';

// A value placeholder sized to sit on the right of a BillingRow.
function Value({ width }: { width: string }) {
  return <Skeleton className={`h-4 ${width}`} />;
}

// Mirrors a DashboardInfoCard: real uppercase title, skeleton value, and an
// optional progress ring (shown for committed packages, hidden for PAYG).
function InfoCardSkeleton({ title, withProgress = true }: { title: string; withProgress?: boolean }) {
  return (
    <div className="h-[94px] bg-ods-card border border-ods-border rounded-sm p-[var(--spacing-system-m)] flex gap-[var(--spacing-system-s)] items-center">
      <div className="flex-1 flex flex-col gap-2">
        <p className="text-h5 text-ods-text-secondary">{title}</p>
        <Skeleton className="h-7 w-24" />
      </div>
      {withProgress && <Skeleton className="size-12 rounded-full shrink-0" />}
    </div>
  );
}

/**
 * Mirrors a `UsageStatCard`: the title is fixed copy and stays real; the figure
 * is a bar.
 *
 * So is the caption, unless the caller passes one. The device card's caption is
 * as query-dependent as its figure — "Trial Period ends 12/15/26", "Annual
 * Prepaid" and "Pay as you go" are three different answers to what the response
 * says — so printing any of them here would be a guess that visibly rewrites
 * itself on load. The AI card has only ever had the one caption, and passes it.
 */
function StatCardSkeleton({ title, caption }: { title: string; caption?: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col justify-center gap-[var(--spacing-system-xsf)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-mf)]">
      <div className="flex flex-col gap-1">
        <p className="truncate text-h5 text-ods-text-secondary">{title}</p>
        <Skeleton className="h-8 w-24" />
      </div>
      <p className="truncate text-h6 text-ods-text-secondary">{caption ?? <InlineSkeleton className="h-3 w-32" />}</p>
    </div>
  );
}

/**
 * Rows drawn for the invoices table while it loads. Fewer than the list-page
 * default of 10: this table sits at the bottom of a page that is mostly cards
 * and rows, and a workspace's invoice history is short — ten bars would claim
 * more of the page than the data usually fills.
 */
const INVOICE_SKELETON_ROWS = 3;

export function BillingUsageSkeleton() {
  const handleBack = useSafeBack(routes.settings.root());

  // Mirror the usage-only page (see `usage-view.tsx`) when the payment UI is
  // hidden — otherwise the loading state would flash a "Billing & Usage" title,
  // a Next Payment row, and an invoices table the real page never renders.
  if (isBillingHidden()) {
    return (
      <PageLayout
        title="Usage"
        className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
        backButton={{ label: 'Back', onClick: handleBack }}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--spacing-system-m)]">
          <InfoCardSkeleton title="Device Usage" />
          <InfoCardSkeleton title="AI Usage" withProgress={false} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--spacing-system-l)] items-stretch">
          <SectionBlock title="Usage Overview">
            <BillingRow label="Active devices" value={<Value width="w-8" />} />
            <BillingRow label="Inactive devices" value={<Value width="w-8" />} />
          </SectionBlock>
          <SectionBlock title="Workspace Limits">
            <BillingRow label="Devices included" value={<Value width="w-8" />} />
          </SectionBlock>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Billing & Usage"
      className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
      backButton={{ label: 'Back to Settings', onClick: handleBack }}
    >
      <TestModeBanner />

      <div className="grid gap-[var(--spacing-system-m)] md:grid-cols-2">
        <StatCardSkeleton title="Device Usage" />
        <StatCardSkeleton title="AI Usage" caption="Pay as you go" />
      </div>

      <SectionBlock title="Current Plan">
        <BillingRow label="Billing Cycle" value={<Value width="w-16" />} />
        <BillingRow label="Device Rate" value={<Value width="w-20" />} />
        <BillingRow label="Next Payment" value={<Value width="w-16" />} />
        <BillingRow label="Next Billing Date" value={<Value width="w-20" />} />
      </SectionBlock>

      <div className="flex flex-col gap-[var(--spacing-system-l)]">
        <h2 className="text-h2 text-ods-text-primary">Invoices History</h2>
        <Input startAdornment={<SearchIcon />} placeholder="Search for Invoice" className="w-full" readOnly />
        <TableSkeleton columns={INVOICES_TABLE_COLUMNS} rows={INVOICE_SKELETON_ROWS} />
      </div>
    </PageLayout>
  );
}
