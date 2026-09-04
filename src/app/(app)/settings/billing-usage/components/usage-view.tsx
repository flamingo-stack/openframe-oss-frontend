'use client';

import { AlertTriangleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { DashboardInfoCard, PageLayout } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { usageViewQuery as UsageViewQueryType } from '@/__generated__/usageViewQuery.graphql';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { OpenframeProduct, SubscriptionProductStatus } from '@/generated/schema-enums';
import { routes } from '@/lib/routes';
import { formatCount } from '../lib/format';
import { BillingRow, SectionBlock } from './billing-section';

/**
 * Consumption-only query. Deliberately NOT the billing page's query: it asks for
 * usage counters and committed quantities, and for nothing priced — no
 * `nextPayment`, no `pendingInvoices`, no option `price`. The builds that render
 * this are the ones not allowed to show payments (see `billing-visibility.ts`),
 * so pricing data must not even reach the device.
 */
const usageViewQuery = graphql`
  query usageViewQuery {
    subscription {
      id
      products {
        name
        packageOptions {
          quantity
          status
        }
        payAsYouGoOption {
          id
        }
      }
      usage {
        devicesUsed
        activeDevices
        inactiveDevices
        aiTokensUsed
      }
    }
  }
`;

/**
 * Payment-free variant of the Billing & Usage page, rendered when the payment UI
 * is hidden for this build.
 *
 * The line it draws is *purchasing mechanism*, not *any mention of the account*:
 * App Store Guideline 3.1.1 bans prices, plans, and CTAs that lead to a non-IAP
 * purchase, so what stays is how much the workspace consumes and how that
 * compares to its limits — the operational half of the page.
 *
 * Kept:  usage counters + progress, the entitlement limits behind them, and
 *        limit warnings (worded without the pay-as-you-go/upgrade framing the
 *        billing page uses — see `use-billing-summary.ts`).
 * Dropped: prices, Next Payment, invoices, trial/plan-end dates, "Package"/
 *        "Pay as you go" labels, and every Update/Activate/Pay/Cancel action.
 */
export function UsageView() {
  const handleBack = useSafeBack(routes.settings.root());
  const data = useLazyLoadQuery<UsageViewQueryType>(usageViewQuery, {}, { fetchPolicy: 'store-and-network' });

  const subscription = data.subscription;
  const products = subscription?.products ?? [];
  const deviceProduct = products.find(p => p.name === OpenframeProduct.MANAGED_DEVICES) ?? null;
  const aiProduct = products.find(p => p.name === OpenframeProduct.AI_ASSISTANCE) ?? null;
  const deviceActive = deviceProduct?.packageOptions.find(o => o.status === SubscriptionProductStatus.ACTIVE) ?? null;

  const devicesUsed = subscription?.usage?.devicesUsed ?? 0;
  const activeDevices = subscription?.usage?.activeDevices ?? 0;
  const inactiveDevices = subscription?.usage?.inactiveDevices ?? 0;

  // A product billed per use has no committed limit to compare against, so it
  // shows the bare count — and never a warning, since there is nothing to exceed.
  const devicePerUse = deviceProduct?.payAsYouGoOption != null && deviceActive == null;
  const hasAi = aiProduct != null;

  // AI is metered consumption — never a bought balance, and no locally-derived
  // free allowance either (those figures are to come from the backend). With
  // nothing to measure against, the card shows the bare count and no ring.
  const aiTokensUsed = Number(subscription?.usage?.aiTokensUsed ?? 0);

  const deviceLimit = deviceActive?.quantity ?? 0;
  const devicePct = deviceLimit > 0 ? Math.round((devicesUsed / deviceLimit) * 100) : 0;
  // Only the state that has actually happened. The 90%-of-limit "approaching"
  // tier is gone here for the same reason as on the billing page: being near a
  // limit costs nothing, and a banner that fires before anything changed is one
  // users learn to scroll past.
  const deviceOverLimit = !devicePerUse && deviceLimit > 0 && devicesUsed > deviceLimit;

  const showDeviceLimit = !devicePerUse && deviceLimit > 0;
  const showLimits = showDeviceLimit;

  return (
    <PageLayout
      title="Usage"
      className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
      backButton={{ label: 'Back', onClick: handleBack }}
    >
      <div className={cn('grid gap-[var(--spacing-system-m)]', hasAi ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1')}>
        <DashboardInfoCard
          title="Device Usage"
          value={devicesUsed}
          percentage={devicePerUse ? undefined : devicePct}
          progressVariant={deviceOverLimit ? 'warning' : 'success'}
          showProgress={showDeviceLimit}
          progressOverflow="wrap"
        />
        {hasAi && <DashboardInfoCard title="AI Usage" value={aiTokensUsed} />}
      </div>

      {deviceOverLimit && (
        <div className="flex items-start gap-[var(--spacing-system-m)] rounded-md border border-ods-warning bg-ods-card p-[var(--spacing-system-m)]">
          <AlertTriangleIcon className="size-6 shrink-0 text-ods-warning" />
          <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
            <p className="font-bold text-ods-text-primary text-h3">You're over your device limit</p>
            <p className="text-ods-text-secondary text-h4">
              Your workspace administrator can raise the limit for your team.
            </p>
          </div>
        </div>
      )}

      <div
        className={cn('grid grid-cols-1 items-stretch gap-[var(--spacing-system-l)]', showLimits && 'md:grid-cols-2')}
      >
        <SectionBlock title="Usage Overview">
          <BillingRow label="Active devices" value={formatCount(activeDevices)} />
          <BillingRow label="Inactive devices" value={formatCount(inactiveDevices)} />
        </SectionBlock>
        {showLimits && (
          <SectionBlock title="Workspace Limits">
            {showDeviceLimit && <BillingRow label="Devices included" value={formatCount(deviceLimit)} />}
          </SectionBlock>
        )}
      </div>
    </PageLayout>
  );
}
