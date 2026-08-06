import type { billingUsageContentQuery$data } from '@/__generated__/billingUsageContentQuery.graphql';
import { SubscriptionStatus } from '@/app/components/subscription-lock/subscription-status';
import { BillingPeriod, OpenframeProduct, SubscriptionProductStatus } from '@/generated/schema-enums';
import type { UsageStatTone } from '../components/usage-stat-card';
import { freeTokensForPlan } from '../lib/ai-free-tokens';
import { aiTokenPrice as tokenPriceFromUnit } from '../lib/ai-token-price';

type SubscriptionData = billingUsageContentQuery$data['subscription'];
type BillingPlanData = billingUsageContentQuery$data['billingPlan'];

/**
 * How much of the AI cap has to be spent before the page says so. The warning
 * exists to be actionable — early enough to raise the limit before Fae and Mingo
 * stop, late enough that it is not noise on a limit barely touched.
 */
const AI_CAP_WARNING_RATIO = 0.9;

export function useBillingSummary(subscription: SubscriptionData, billingPlan: BillingPlanData) {
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

  const deviceCatalogProduct = billingPlan?.products.find(p => p.name === OpenframeProduct.MANAGED_DEVICES) ?? null;

  /**
   * What one device costs per month on a given billing period, per the CATALOG.
   *
   * `null` means pay-as-you-go. Devices are priced by period and not by
   * quantity, so a period's entry price band IS its rate — the same figure, read
   * the same way, that `useDevicePlanSelection` prices the paywall's panels
   * from. Reading it here too is what keeps "Device Rate" and the plan picker
   * from quoting two different numbers for one plan.
   */
  const catalogDeviceRate = (period: string | null): number | null => {
    const option =
      period == null
        ? deviceCatalogProduct?.payAsYouGoOption
        : deviceCatalogProduct?.packageOptions.find(o => o.billingPeriod === period);
    return option?.price ?? option?.priceTiers?.[0]?.unitPrice ?? null;
  };

  /**
   * What one device costs per month under a committed option.
   *
   * The subscription's own `price` first — a negotiated rate is what this tenant
   * is actually billed — then the catalog's rate for the same period. The
   * fallback is not decoration: a committed option comes back with `price`
   * empty, which left an annual plan with no "Device Rate" row at all, and its
   * own `priceTiers` answer with the undiscounted monthly rate rather than the
   * annual one it is on.
   */
  const committedRate = (option: typeof managedDevicesActive | null): number | null =>
    option?.price ?? catalogDeviceRate(option?.billingPeriod ?? null);

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
   * AI is consumption against two figures the backend serves itself: the free
   * grant for the period, and the ceiling the customer put on what may be billed
   * beyond it. Nothing here is derived from an AI package — there is none to buy.
   *
   * The cap is stored in USD, and the cards count tokens, so the metered rate
   * converts between them. Without a rate the paid counter simply has no
   * denominator; it never invents one.
   */
  /**
   * The tenant's own metered rate, per token.
   *
   * Two records for one figure, on purpose: the price is the SUBSCRIPTION's (a
   * negotiated rate is what this tenant is actually billed), while `unitSize` —
   * the block that price is quoted per — exists only on the catalog product.
   * Either half missing leaves the rate unknown, and no AI price is printed.
   */
  const aiCatalogProduct = billingPlan?.products.find(p => p.name === OpenframeProduct.AI_ASSISTANCE) ?? null;
  const aiTokenPrice = tokenPriceFromUnit(aiProduct?.payAsYouGoOption?.price, aiCatalogProduct?.unitSize);
  const aiTokensFree = Number(subscription?.usage?.aiTokensFree ?? 0);
  const aiTokensFreeUsed = Number(subscription?.usage?.aiTokensFreeUsed ?? 0);
  const aiTokensPaid = Number(subscription?.usage?.aiTokensOverage ?? 0);
  const aiSpendUsd = subscription?.usage?.aiSpendUsd ?? 0;
  const aiCapUsd = subscription?.aiSpendCapUsd ?? null;

  /**
   * A cap of 0 is a real cap — nothing beyond the free tokens — so this is a
   * null check, never a falsy one, everywhere the cap is read.
   */
  const aiCapped = aiCapUsd != null;
  const aiCapReached = aiCapped && aiSpendUsd >= aiCapUsd;
  const aiCapNear = aiCapped && !aiCapReached && aiSpendUsd >= aiCapUsd * AI_CAP_WARNING_RATIO;

  const ai = {
    tokenPrice: aiTokenPrice,
    free: aiTokensFree,
    freeUsed: aiTokensFreeUsed,
    /** Tokens spent past the free grant — the ones that get billed. */
    paid: aiTokensPaid,
    spendUsd: aiSpendUsd,
    capUsd: aiCapUsd,
    /** The cap told back in tokens, which is the unit the counter is in. */
    capTokens: aiCapped && aiTokenPrice ? Math.round(aiCapUsd / aiTokenPrice) : null,
    capReached: aiCapReached,
    capNear: aiCapNear,
    tone: (aiCapReached ? 'error' : aiCapNear ? 'warning' : 'default') as UsageStatTone,
  };

  /**
   * When the committed device package stops.
   *
   * This is the ONLY signal that a plan change is coming, and it has to be,
   * because the obvious one is not always there: downgrading to pay-as-you-go
   * schedules no replacement package (pay-as-you-go is not a package), so
   * `PENDING_ACTIVATION` stays empty and only this date appears. A downgrade to
   * another package sets both.
   *
   * It is read for a package that is genuinely ending, not renewing — the
   * backend sets it when the commitment is scheduled to stop (`endDate =
   * phaseStart - 1`, see `subscription.utils.ts`). A cancellation is excluded
   * below: that has its own field, and the two would print the same day twice.
   */
  const deviceCommitmentEndsOn = (managedDevicesActive?.endDate ?? null) as string | null;
  const hasScheduledPackage = managedDevicesPending != null;
  const planEnds = deviceCommitmentEndsOn != null && !isPendingCancellation;
  /** Nothing takes over: the commitment lapses and billing reverts to metered. */
  const revertsToPayg = planEnds && !hasScheduledPackage;

  /**
   * The plan the subscription moves to, described in the same vocabulary as the
   * current one — cycle, rates, grant — because the two sit side by side and
   * anything the left column states the right one has to be able to state too.
   *
   * Either a scheduled package, or the metered billing a lapsing commitment
   * falls back to. The pay-as-you-go case has no record to read: its cycle is
   * monthly by definition, its rate is the product's metered one, and it starts
   * the day the commitment ends.
   */
  const hasPendingPlan = hasScheduledPackage || revertsToPayg;
  // Metered billing has no period, so `null` asks the catalog for exactly that.
  const paygDeviceRate = managedDevicesProduct?.payAsYouGoOption?.price ?? catalogDeviceRate(null);
  const updatedPlan = {
    isAnnual: hasScheduledPackage && managedDevicesPending?.billingPeriod === BillingPeriod.YEARLY,
    deviceRate: hasScheduledPackage ? committedRate(managedDevicesPending) : paygDeviceRate,
    startsOn: (hasScheduledPackage ? (managedDevicesPending?.startDate ?? null) : deviceCommitmentEndsOn) as
      | string
      | null,
    /** Derived, not fetched — see `freeTokensForPlan`. A package keeps the larger grant. */
    freeTokens: freeTokensForPlan(hasScheduledPackage),
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
       * What one device costs per month — the metered rate, or the rate the
       * active package fixed. Every figure in play is per device per month (the
       * same scale as `priceTiers.unitPrice`), so an annual commitment states a
       * monthly rate here and bills twelve of them at once.
       *
       * The rate is looked up FOR THE PERIOD the plan is on (see
       * `committedRate`). It is never borrowed across periods: an annual plan is
       * not billed at the metered rate, and printing that here would name a
       * price the user is not paying — which is exactly what a plain
       * "first price band" read did, quoting the undiscounted $1.00 to a
       * subscription paying $0.80.
       */
      deviceRate: deviceIsPayg ? paygDeviceRate : committedRate(managedDevicesActive),
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
       * When the CURRENT package stops — whether a scheduled one takes over or
       * billing simply reverts to metered. See `deviceCommitmentEndsOn` for why
       * the date itself is the signal rather than the presence of a replacement.
       */
      currentPlanEndsOn: planEnds ? deviceCommitmentEndsOn : null,
      trialExpirationDate,
      latestPendingInvoice,
    },
  };
}
