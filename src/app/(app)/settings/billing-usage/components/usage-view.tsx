'use client';

import { AlertTriangleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { DashboardInfoCard, PageLayout } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import type { useBillingSummary } from '../hooks/use-billing-summary';
import { formatCount } from '../lib/format';
import { BillingRow, SectionBlock } from './billing-section';

type BillingSummary = ReturnType<typeof useBillingSummary>;

interface UsageViewProps {
  summary: BillingSummary;
  onBack: () => void;
}

/**
 * Payment-free variant of the Billing & Usage page, rendered when the payment UI
 * is hidden for this build (`isBillingHidden()` — see `billing-visibility.ts`).
 *
 * The line it draws is *purchasing mechanism*, not *any mention of the account*:
 * App Store Guideline 3.1.1 bans prices, plans, and CTAs that lead to a non-IAP
 * purchase, so what stays is how much the workspace consumes and how that
 * compares to its limits — the operational half of the page.
 *
 * Kept:  usage counters + progress, the entitlement limits behind them, and
 *        limit warnings (reworded to drop the pay-as-you-go/upgrade wording the
 *        billing page uses — see `use-billing-summary.ts`).
 * Dropped: prices, Next Payment, invoices, trial/plan-end dates, "Package"/
 *        "Pay as you go" labels, and every Update/Activate/Pay/Cancel action.
 */
export function UsageView({ summary, onBack }: UsageViewProps) {
  const { device, ai, flags } = summary;

  // Committed allocations only. A pay-as-you-go product has no limit to show,
  // and naming it would put the billing model back on screen.
  const showDeviceLimit = !device.isPayg && device.allocation > 0;
  const showAiLimit = flags.hasAi && !ai.isPayg && ai.allocation > 0;

  const warnings: Array<{ title: string; description: string }> = [];
  if (device.state === 'warning' || device.state === 'over') {
    warnings.push({
      title: device.state === 'over' ? "You're over your device limit" : "You're approaching your device limit",
      description: 'Your workspace administrator can raise the limit for your team.',
    });
  }
  if (flags.hasAi && (ai.state === 'warning' || ai.state === 'over')) {
    warnings.push({
      title: ai.state === 'over' ? "You're over your AI token limit" : "You're approaching your AI token limit",
      description: 'Your workspace administrator can raise the limit for your team.',
    });
  }

  return (
    <PageLayout
      title="Usage"
      className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
      backButton={{ label: 'Back', onClick: onBack }}
    >
      <div
        className={cn('grid gap-[var(--spacing-system-m)]', flags.hasAi ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1')}
      >
        <DashboardInfoCard
          title="Device Usage"
          value={device.used}
          // No allocation to compare against (pay-as-you-go) → the bare count,
          // same as the full billing page does.
          percentage={device.isPayg ? undefined : device.pct}
          progressVariant={device.progressVariant}
          showProgress={device.showProgress}
          progressOverflow="wrap"
        />
        {flags.hasAi && (
          <DashboardInfoCard
            title="AI Usage"
            value={ai.used}
            percentage={ai.isPayg ? undefined : ai.pct}
            progressVariant={ai.progressVariant}
            showProgress={ai.showProgress}
            progressOverflow="wrap"
          />
        )}
      </div>

      {warnings.length > 0 && (
        <div className="flex flex-col rounded-md border border-ods-warning overflow-hidden bg-ods-card">
          {warnings.map((w, idx) => (
            <div
              key={w.title}
              className={cn(
                'flex gap-[var(--spacing-system-m)] p-[var(--spacing-system-m)] items-start',
                idx > 0 && 'border-t border-ods-warning',
              )}
            >
              <AlertTriangleIcon className="size-6 shrink-0 text-ods-warning" />
              <div className="flex flex-col gap-1">
                <p className="text-h3 font-bold text-ods-warning">{w.title}</p>
                <p className="text-h4 text-ods-warning">{w.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div
        className={cn(
          'grid grid-cols-1 gap-[var(--spacing-system-l)] items-stretch',
          (showDeviceLimit || showAiLimit) && 'md:grid-cols-2',
        )}
      >
        <SectionBlock title="Usage Overview">
          <BillingRow label="Active devices" value={formatCount(device.active)} />
          <BillingRow label="Inactive devices" value={formatCount(device.inactive)} />
        </SectionBlock>
        {(showDeviceLimit || showAiLimit) && (
          <SectionBlock title="Workspace Limits">
            {showDeviceLimit && <BillingRow label="Devices included" value={formatCount(device.allocation)} />}
            {showAiLimit && <BillingRow label="AI tokens included" value={formatCount(ai.allocation)} />}
          </SectionBlock>
        )}
      </div>
    </PageLayout>
  );
}
