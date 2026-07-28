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

const WARNING_THRESHOLD = 90;

type UsageState = 'success' | 'warning' | 'over';

function usageState(pct: number, isOver: boolean): UsageState {
  if (isOver) return 'over';
  if (pct >= WARNING_THRESHOLD) return 'warning';
  return 'success';
}

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
  const aiActive = aiProduct?.packageOptions.find(o => o.status === SubscriptionProductStatus.ACTIVE) ?? null;

  const devicesUsed = subscription?.usage?.devicesUsed ?? 0;
  const activeDevices = subscription?.usage?.activeDevices ?? 0;
  const inactiveDevices = subscription?.usage?.inactiveDevices ?? 0;
  const aiTokensUsed = subscription?.usage?.aiTokensUsed ?? 0;

  // A product billed per use has no committed limit to compare against, so it
  // shows the bare count — and never a warning, since there is nothing to exceed.
  const devicePerUse = deviceProduct?.payAsYouGoOption != null && deviceActive == null;
  const aiPerUse = aiProduct?.payAsYouGoOption != null && aiActive == null;
  const hasAi = aiActive != null || aiPerUse;

  const deviceLimit = deviceActive?.quantity ?? 0;
  const aiLimit = aiActive?.quantity ?? 0;
  const devicePct = deviceLimit > 0 ? Math.round((devicesUsed / deviceLimit) * 100) : 0;
  const aiPct = aiLimit > 0 ? Math.round((aiTokensUsed / aiLimit) * 100) : 0;
  const deviceState = devicePerUse ? 'success' : usageState(devicePct, deviceLimit > 0 && devicesUsed > deviceLimit);
  const aiState = aiPerUse || !hasAi ? 'success' : usageState(aiPct, aiLimit > 0 && aiTokensUsed > aiLimit);

  const showDeviceLimit = !devicePerUse && deviceLimit > 0;
  const showAiLimit = hasAi && !aiPerUse && aiLimit > 0;
  const showLimits = showDeviceLimit || showAiLimit;

  const warnings: Array<{ title: string; description: string }> = [];
  if (deviceState === 'warning' || deviceState === 'over') {
    warnings.push({
      title: deviceState === 'over' ? "You're over your device limit" : "You're approaching your device limit",
      description: 'Your workspace administrator can raise the limit for your team.',
    });
  }
  if (hasAi && (aiState === 'warning' || aiState === 'over')) {
    warnings.push({
      title: aiState === 'over' ? "You're over your AI token limit" : "You're approaching your AI token limit",
      description: 'Your workspace administrator can raise the limit for your team.',
    });
  }

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
          progressVariant={deviceState === 'success' ? 'success' : 'warning'}
          showProgress={showDeviceLimit}
          progressOverflow="wrap"
        />
        {hasAi && (
          <DashboardInfoCard
            title="AI Usage"
            value={aiTokensUsed}
            percentage={aiPerUse ? undefined : aiPct}
            progressVariant={aiState === 'success' ? 'success' : 'warning'}
            showProgress={showAiLimit}
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
              <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
                <p className="text-h3 font-bold text-ods-warning">{w.title}</p>
                <p className="text-h4 text-ods-warning">{w.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div
        className={cn('grid grid-cols-1 gap-[var(--spacing-system-l)] items-stretch', showLimits && 'md:grid-cols-2')}
      >
        <SectionBlock title="Usage Overview">
          <BillingRow label="Active devices" value={formatCount(activeDevices)} />
          <BillingRow label="Inactive devices" value={formatCount(inactiveDevices)} />
        </SectionBlock>
        {showLimits && (
          <SectionBlock title="Workspace Limits">
            {showDeviceLimit && <BillingRow label="Devices included" value={formatCount(deviceLimit)} />}
            {showAiLimit && <BillingRow label="AI tokens included" value={formatCount(aiLimit)} />}
          </SectionBlock>
        )}
      </div>
    </PageLayout>
  );
}
