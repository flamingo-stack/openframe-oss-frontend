import type { billingUsageContentQuery$data } from '@/__generated__/billingUsageContentQuery.graphql';
import { SubscriptionStatus } from '@/app/components/subscription-lock/subscription-status';
import { BillingPeriod, OpenframeProduct, SubscriptionProductStatus } from '@/generated/schema-enums';
import { deriveAiTokenUsage } from '../lib/ai-tokens';

const WARNING_THRESHOLD = 90;

export type UsageState = 'success' | 'warning' | 'over';

/**
 * `over` is driven by real overage (used > allocation), not the rounded
 * percentage: at exactly 100% (used === allocation) you're at the limit, not
 * over it, so it stays a warning. `warning` covers the 90–100% approach.
 */
function getUsageState(percentage: number, isOver: boolean): UsageState {
  if (isOver) return 'over';
  if (percentage >= WARNING_THRESHOLD) return 'warning';
  return 'success';
}

type SubscriptionData = billingUsageContentQuery$data['subscription'];

export function useBillingSummary(subscription: SubscriptionData) {
  const subscriptionProducts = subscription?.products ?? [];
  const status = subscription?.status ?? SubscriptionStatus.ACTIVE;
  const pendingInvoices = subscription?.pendingInvoices ?? [];
  const latestPendingInvoice =
    [...pendingInvoices].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ?? null;

  const devicesUsed = subscription?.usage?.devicesUsed ?? 0;
  const activeDevices = subscription?.usage?.activeDevices ?? 0;
  const inactiveDevices = subscription?.usage?.inactiveDevices ?? 0;
  const aiTokensUsed = Number(subscription?.usage?.aiTokensUsed ?? 0);
  // Server-computed projected next-invoice total (PAYG overage so far + package
  // charges due next cycle). SSOT for the "Next Payment" row — null when there's
  // no upcoming charge (e.g. trial).
  const nextPayment = subscription?.nextPayment ?? null;

  const managedDevicesProduct = subscriptionProducts.find(p => p.name === OpenframeProduct.MANAGED_DEVICES) ?? null;
  const aiProduct = subscriptionProducts.find(p => p.name === OpenframeProduct.AI_ASSISTANCE) ?? null;
  const managedDevicesActive =
    managedDevicesProduct?.packageOptions.find(o => o.status === SubscriptionProductStatus.ACTIVE) ?? null;

  // A scheduled downgrade surfaces as a PENDING_ACTIVATION option. Devices only:
  // AI has no committed package to schedule a change to (see the `ai` block).
  const managedDevicesPending =
    managedDevicesProduct?.packageOptions.find(o => o.status === SubscriptionProductStatus.PENDING_ACTIVATION) ?? null;

  const trialExpirationDate = subscription?.trialExpirationDate ?? null;
  const isTrial = status === SubscriptionStatus.TRIAL;
  const isPendingCancellation = status === SubscriptionStatus.PENDING_CANCELLATION;
  const isOverdue =
    status === SubscriptionStatus.PAST_DUE ||
    status === SubscriptionStatus.SUSPENDED ||
    status === SubscriptionStatus.CANCELED;

  const deviceIsPayg = managedDevicesProduct?.payAsYouGoOption != null && managedDevicesActive == null;
  // Every workspace carrying the AI product gets the free monthly tokens, whether
  // or not it has ever paid for consumption beyond them.
  const hasAi = aiProduct != null;

  const deviceAllocation = managedDevicesActive?.quantity ?? 0;
  const devicePct = deviceAllocation > 0 ? Math.round((devicesUsed / deviceAllocation) * 100) : 0;
  const deviceOverage = Math.max(0, devicesUsed - deviceAllocation);
  const deviceState: UsageState = deviceIsPayg
    ? 'success'
    : getUsageState(devicePct, deviceAllocation > 0 && deviceOverage > 0);

  /**
   * AI is consumption, not a balance: a free monthly allowance, then metered
   * pay-as-you-go past it. There is no bought token bank to sit against, so
   * nothing here reads an AI package quantity, and running past the free tokens
   * raises no warning — it starts billing, which is the product working, not a
   * limit being breached.
   */
  const ai = deriveAiTokenUsage(aiTokensUsed);

  const warnings: Array<{ title: string; description: string }> = [];
  if (deviceState === 'warning') {
    warnings.push({
      title: "You're approaching your Device Package limit",
      description: 'Any devices above it will be billed at pay-as-you-go rates, charged separately from your plan.',
    });
  } else if (deviceState === 'over') {
    warnings.push({
      title: "You're over your Device Package limit",
      description:
        'Extra devices will be billed at pay-as-you-go rates, charged separately from your plan. Upgrade to lock in a lower device price.',
    });
  }

  const showOverageBlock = deviceState === 'over';
  const accentClass = isOverdue ? 'text-ods-error' : 'text-ods-warning';
  const accentBorderClass = isOverdue ? 'border-ods-error' : 'border-ods-warning';

  const nextBilling = isPendingCancellation
    ? (subscription?.cancellationEffectiveAt ?? managedDevicesActive?.endDate ?? null)
    : (managedDevicesActive?.endDate ?? subscription?.currentPeriodEnd ?? null);

  const isNearLimits = !deviceIsPayg && (deviceState === 'warning' || deviceState === 'over');

  const hasPendingPlan = managedDevicesPending != null;
  const updatedPlan = {
    deviceQuantity: managedDevicesPending?.quantity ?? 0,
    startDate: (managedDevicesPending?.startDate ?? null) as string | null,
  };

  return {
    status,
    flags: { isTrial, isPendingCancellation, isOverdue, isNearLimits, hasAi, hasPendingPlan },
    updatedPlan,
    device: {
      used: devicesUsed,
      active: activeDevices,
      inactive: inactiveDevices,
      state: deviceState,
      isPayg: deviceIsPayg,
      allocation: deviceAllocation,
      overage: deviceOverage,
    },
    ai,
    plan: {
      // A committed yearly package is the only thing that makes the cycle annual;
      // pay-as-you-go and every monthly package bill each month.
      isAnnual: managedDevicesActive?.billingPeriod === BillingPeriod.YEARLY,
      /**
       * What one device costs per month — the pay-as-you-go rate, or the rate the
       * active package fixed. Both `price` fields are per unit per month (the same
       * scale as `priceTiers.unitPrice`), so the annual commitment states a monthly
       * rate here and bills twelve of them at once.
       */
      deviceRate:
        (deviceIsPayg
          ? managedDevicesProduct?.payAsYouGoOption?.price
          : (managedDevicesActive?.price ?? managedDevicesProduct?.payAsYouGoOption?.price)) ?? null,
    },
    ui: { warnings, showOverageBlock, accentClass, accentBorderClass },
    billing: {
      nextPayment,
      nextBilling,
      latestPendingInvoice,
      trialExpirationDate,
      // Non-null only once cancellation is scheduled (PENDING_CANCELLATION /
      // CANCELED) — used by the "Subscription Cancelled" modal after the store
      // is invalidated and the query refetches.
      cancellationEffectiveAt: subscription?.cancellationEffectiveAt ?? null,
    },
  };
}
