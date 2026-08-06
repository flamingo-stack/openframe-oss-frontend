import type { billingUsageContentQuery$data } from '@/__generated__/billingUsageContentQuery.graphql';
import { SubscriptionStatus } from '@/app/components/subscription-lock/subscription-status';
import { BillingPeriod, OpenframeProduct, SubscriptionProductStatus } from '@/generated/schema-enums';

type SubscriptionData = billingUsageContentQuery$data['subscription'];

export function useBillingSummary(subscription: SubscriptionData) {
  const subscriptionProducts = subscription?.products ?? [];
  /**
   * `null` means the tenant has no subscription record at all — NOT that it is
   * fine. This used to default to `ACTIVE`, which is the most reassuring answer
   * available and the one least supported by the data: it drives the lock, the
   * header actions and `needsCheckout`, and it contradicted `SubscriptionGuard`,
   * which reads the same absence as CANCELED and locks the app. Callers render
   * the absence instead of a plan (see `BillingUsageContent`).
   */
  const status = subscription?.status ?? null;
  const pendingInvoices = subscription?.pendingInvoices ?? [];
  const latestPendingInvoice =
    [...pendingInvoices].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ?? null;

  const devicesUsed = subscription?.usage?.devicesUsed ?? 0;
  const activeDevices = subscription?.usage?.activeDevices ?? 0;
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
  // Carrying the AI product at all is what makes its usage worth showing; it is
  // metered, so there is no package to check for.
  const hasAi = aiProduct != null;

  const deviceAllocation = managedDevicesActive?.quantity ?? 0;
  const deviceOverage = Math.max(0, devicesUsed - deviceAllocation);
  /**
   * The one state on this page worth interrupting for: a committed package with
   * more devices under management than it covers.
   *
   * There used to be a second, "approaching" tier at 90% of the allocation, and
   * an AI counterpart to both. Neither survives the product: AI has no limit to
   * approach, and being near a device limit costs nothing — the bill only changes
   * once it is passed, which is what this says. A banner that fires before
   * anything has happened is one users learn to scroll past.
   */
  const deviceOverLimit = !deviceIsPayg && deviceAllocation > 0 && deviceOverage > 0;

  /**
   * AI is consumption, and only consumption. No bought token bank to sit against
   * (so nothing here reads an AI package quantity), and no locally-derived free
   * allowance either — the free-token figures are to come from the backend as
   * their own fields. Until they do, the only honest AI number is what was used.
   */
  const ai = { used: aiTokensUsed };

  /**
   * A scheduled plan change, described in the same vocabulary as the current one
   * — cycle and rate, not a bare package size. The two sit side by side, so
   * anything the left column states the right one has to be able to state too.
   */
  const hasPendingPlan = managedDevicesPending != null;
  const updatedPlan = {
    isAnnual: managedDevicesPending?.billingPeriod === BillingPeriod.YEARLY,
    deviceRate: managedDevicesPending?.price ?? null,
    startsOn: (managedDevicesPending?.startDate ?? null) as string | null,
  };

  return {
    status,
    flags: { isTrial, isPendingCancellation, isOverdue, hasAi, hasPendingPlan },
    updatedPlan,
    device: {
      used: devicesUsed,
      // Read by the cancellation modal's impact list, not by the page itself.
      active: activeDevices,
      allocation: deviceAllocation,
      overage: deviceOverage,
      overLimit: deviceOverLimit,
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
       *
       * A committed package that reports no price falls back to nothing, not to the
       * pay-as-you-go rate: a prepaid plan is not billed at the metered rate, and
       * printing it here would name a price the user is not paying. The row is
       * omitted instead.
       */
      deviceRate: (deviceIsPayg ? managedDevicesProduct?.payAsYouGoOption?.price : managedDevicesActive?.price) ?? null,
    },
    /**
     * Three dates, three fields, no substituting one for another. The schema says
     * which answers which, and each is `null` exactly when it does not apply:
     *
     * - `currentPeriodEnd` — "End of the currently paid billing period. For ACTIVE
     *   subscriptions this is the next renewal date."
     * - `cancellationEffectiveAt` — "When the subscription will actually be
     *   terminated. Non-null only for PENDING_CANCELLATION / CANCELED."
     * - `trialExpirationDate` — when the trial lapses.
     *
     * This was one `nextBilling` value chained through
     * `cancellationEffectiveAt ?? activePackage.endDate ?? currentPeriodEnd`. A
     * package's `endDate` is when THAT package stops, not when the subscription
     * bills — and on a scheduled cancellation it equals the termination date, so
     * "Next Billing Date" and "Plan ends on" printed the same day. A chain like
     * that cannot be right: it answers a question with whichever field happens to
     * be populated, and every answer it gives is stated to the user as fact.
     */
    billing: {
      nextPayment,
      /**
       * What the metered surplus has cost so far this period, straight from
       * Stripe's own forecast (`currentInvoice.estimatedOverage`, in cents).
       *
       * NOT `overage × deviceRate`: that multiplication assumes which rate the
       * surplus is billed at, and the plan's rate is not the metered one the
       * overage copy promises. The server knows; the page states what it says.
       */
      estimatedOverage:
        subscription?.currentInvoice != null ? subscription.currentInvoice.estimatedOverage / 100 : null,
      nextBillingDate: subscription?.currentPeriodEnd ?? null,
      cancellationEffectiveAt: subscription?.cancellationEffectiveAt ?? null,
      /**
       * When the CURRENT package stops because a scheduled one takes over. The
       * backend ends the active package the moment an ADD is accepted
       * (`endDate = phaseStart - 1`, see `subscription.utils.ts`), so this is its
       * own fact with its own field — read only while a change is pending,
       * because an annual package always carries an `endDate` and printing it
       * unconditionally would announce an ending that is really a renewal.
       */
      currentPlanEndsOn: hasPendingPlan ? (managedDevicesActive?.endDate ?? null) : null,
      trialExpirationDate,
      latestPendingInvoice,
    },
  };
}
