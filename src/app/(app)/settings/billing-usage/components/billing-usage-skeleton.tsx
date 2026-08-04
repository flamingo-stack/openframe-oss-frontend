'use client';

import { ExternalLinkIcon, SearchIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Input, PageLayout, Skeleton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { isBillingHidden } from '@/lib/billing-visibility';
import { routes } from '@/lib/routes';
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

// Mirrors a UsageStatCard: real title and caption (both fixed copy), skeleton
// value. Only the figure is waiting on the server, so only the figure is a bar.
function StatCardSkeleton({ title, caption }: { title: string; caption: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col justify-center gap-[var(--spacing-system-xsf)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-mf)]">
      <div className="flex flex-col gap-1">
        <p className="truncate text-h5 text-ods-text-secondary">{title}</p>
        <Skeleton className="h-8 w-24" />
      </div>
      <p className="truncate text-h6 text-ods-text-secondary">{caption}</p>
    </div>
  );
}

const INVOICE_COLUMNS = ['INVOICE', 'DUE DATE', 'AMOUNT', 'STATUS'] as const;
const INVOICE_ROW_KEYS = ['a', 'b', 'c'] as const;

// Mirrors the Invoices History table: real column headers, skeleton cells, and
// the real (static) external-link action chrome.
function InvoicesTableSkeleton() {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-4 px-3 py-3 border-b border-ods-border">
        {INVOICE_COLUMNS.map(col => (
          <p key={col} className="text-h5 text-ods-text-secondary flex-1">
            {col}
          </p>
        ))}
        <Skeleton className="h-3 w-16 shrink-0" />
      </div>
      {INVOICE_ROW_KEYS.map(key => (
        <div key={key} className="flex items-center gap-4 px-3 py-3 border-b border-ods-border last:border-b-0">
          <Skeleton className="h-4 w-24 flex-1" />
          <Skeleton className="h-4 w-20 flex-1" />
          <Skeleton className="h-4 w-16 flex-1" />
          <div className="flex-1">
            <Skeleton className="h-6 w-20 rounded-md" />
          </div>
          <div className="flex items-center justify-center p-3 bg-ods-card border border-ods-border rounded-md text-ods-text-secondary shrink-0">
            <ExternalLinkIcon className="size-6" />
          </div>
        </div>
      ))}
    </div>
  );
}

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
            <BillingRow label="AI tokens included" value={<Value width="w-16" />} />
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

      <div className="grid gap-[var(--spacing-system-m)] md:grid-cols-3">
        <StatCardSkeleton title="Device Usage" caption="Pay as you go" />
        <StatCardSkeleton title="Free AI Tokens" caption="Updated monthly" />
        <StatCardSkeleton title="AI Usage" caption="Pay as you go" />
      </div>

      <SectionBlock title="Current Plan">
        <BillingRow label="Billing Cycle" value={<Value width="w-16" />} />
        <BillingRow label="Device Rate" value={<Value width="w-20" />} />
        <BillingRow label="Free AI Tokens" value={<Value width="w-20" />} />
        <BillingRow label="Next Payment" value={<Value width="w-16" />} />
        <BillingRow label="Next Billing Date" value={<Value width="w-20" />} />
      </SectionBlock>

      <div className="flex flex-col gap-[var(--spacing-system-l)]">
        <h2 className="text-h2 text-ods-text-primary">Invoices History</h2>
        <Input startAdornment={<SearchIcon />} placeholder="Search for Invoice" className="w-full" readOnly />
        <InvoicesTableSkeleton />
      </div>
    </PageLayout>
  );
}
