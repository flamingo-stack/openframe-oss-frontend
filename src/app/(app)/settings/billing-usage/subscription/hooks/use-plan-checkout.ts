'use client';

import { useMemo, useState } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { usePlanCheckoutQuery as UsePlanCheckoutQueryType } from '@/__generated__/usePlanCheckoutQuery.graphql';
import { OpenframeProduct } from '@/generated/schema-enums';
import { type AiTopUp, useAiTopUp } from '../../hooks/use-ai-top-up';
import { aiTokenPrice } from '../../lib/ai-token-price';
import type { ProductUpdates, SelectionTotal } from '../types/subscription.types';
import type { ProductCheckoutInput } from './use-create-checkout-session';
import type { PackageUpdateInput } from './use-update-subscription';

/**
 * Billing data ONLY.
 *
 * The fleet size comes from `subscription.usage` — NOT from the `devices()`
 * query it used to be spread from. That is app data: a locked workspace has it
 * refused with `SUBSCRIPTION_TRIAL_EXPIRED`, and because `devices` is non-null
 * the refusal nulled this whole payload and crashed the one screen a locked
 * workspace has to be able to render. The same count, counted by billing,
 * carries no such risk.
 */
export const usePlanCheckoutQuery = graphql`
  query usePlanCheckoutQuery {
    billingPlan {
      id
      products {
        id
        name
        packageOptions {
          billingPeriod
        }
        # AI's metered rate, which prices the top-up amounts (what $20 buys).
        # unitSize is what price is quoted per (AI: a block of tokens), so both
        # are needed to price one token.
        unitSize
        payAsYouGoOption {
          id
          price
        }
        ...devicePlanPickerProductFragment
      }
    }
    subscription {
      id
      # NOT aiTokensFree: that is the grant for the period the tenant is in
      # (5M on a trial), and this page previews the plan they are about to buy.
      # See freeTokensForPlan (lib/ai-free-tokens.ts) for what stands in until
      # a prospective figure exists.
      usage {
        activeDevices
      }
      products {
        name
        ...devicePlanPickerSubscriptionFragment
      }
    }
  }
`;

export type PlanCheckoutData = UsePlanCheckoutQueryType['response'];

type CatalogProductRef = NonNullable<PlanCheckoutData['billingPlan']>['products'][number];
type SubscriptionProductRef = NonNullable<PlanCheckoutData['subscription']>['products'][number];

/**
 * The catalog and the subscription, for the form below. Suspends: mount it
 * under a boundary whose fallback is the same form with `null` data, so the
 * wait shows the real controls rather than a spinner where the plan will be.
 */
export function usePlanCheckoutData(): PlanCheckoutData {
  return useLazyLoadQuery<UsePlanCheckoutQueryType>(
    usePlanCheckoutQuery,
    {},
    {
      fetchPolicy: 'store-and-network',
      // This IS the lock screen's data. Gating it behind the subscription gate
      // would park the paywall on the very state it exists to get the user out of.
      networkCacheConfig: { metadata: { skipSubscriptionGate: true } },
    },
  );
}

export interface PlanCheckout {
  /** The catalog is on its way; every slot draws its own pending state. */
  loading: boolean;
  deviceProduct: CatalogProductRef | null;
  deviceSubscriptionProduct: SubscriptionProductRef | null;
  /**
   * Both cards are drawn while loading: this plan has always had the two, and
   * opening on one column only to reflow into two is a worse wait than a card
   * that fills in. Once the catalog answers, it decides.
   */
  showDeviceCard: boolean;
  showAiCard: boolean;
  /**
   * The devices this workspace is currently running — billing's own count
   * (`usage.activeDevices`). One number for the whole form: the heading names
   * it, and the pay-as-you-go panel prices it.
   */
  deviceCount: number | null;
  /** What the device card has picked; `null` until it reports. */
  deviceUpdates: ProductUpdates | null;
  setDeviceUpdates: (updates: ProductUpdates) => void;
  /** The first AI top-up as the user is choosing it. */
  topUp: AiTopUp;
  /** ADD/CANCEL diff, for an existing subscription. */
  packageUpdates: PackageUpdateInput[];
  /** The whole target plan, for a checkout. */
  checkoutProducts: ProductCheckoutInput[];
  /** The device card holds a quantity nobody can be billed for. */
  hasInvalidCustom: boolean;
  selectionTotal: SelectionTotal | null;
  /** The top-up to charge on the checkout; `null` when the plan has no AI product. */
  tokenAmountUsd: number | null;
}

/**
 * The plan as a form, without a frame around it.
 *
 * Two surfaces fill it in — the lock screen (`SubscriptionSettingsView`) and
 * the billing page's Activate Subscription modal — and they buy the same thing
 * with the same button: the device plan, the AI product, and the first top-up,
 * on one Stripe Checkout. So the choices and everything derived from them live
 * here, and each surface only decides where the total and the button go.
 */
export function usePlanCheckout(data: PlanCheckoutData | null): PlanCheckout {
  const loading = data == null;
  // Memoized: the `?? []` fallback is a new array on every render, and the
  // memo below depends on it.
  const products = useMemo(() => data?.billingPlan?.products ?? [], [data?.billingPlan]);
  const subscriptionProducts = data?.subscription?.products ?? [];

  const deviceProduct = products.find(p => p.name === OpenframeProduct.MANAGED_DEVICES) ?? null;
  const aiProduct = products.find(p => p.name === OpenframeProduct.AI_ASSISTANCE) ?? null;
  const deviceSubscriptionProduct = subscriptionProducts.find(p => p.name === OpenframeProduct.MANAGED_DEVICES) ?? null;

  const showDeviceCard = loading || deviceProduct != null;
  const showAiCard = loading || aiProduct != null;

  const deviceCount = data?.subscription?.usage?.activeDevices ?? null;

  // Only the device card takes a plan selection. AI has no package to choose —
  // its card picks a balance (see `AiTokenBalanceCard`).
  const [deviceUpdates, setDeviceUpdates] = useState<ProductUpdates | null>(null);

  /**
   * Held HERE rather than in the card that draws it: it is part of the same
   * form as the plan, and the form's one button is what sends it
   * (`CheckoutInput.tokenAmountUsd`). $50 is picked up front, as the mockup has
   * it — a checkout requires an amount, and a form that starts with nothing
   * chosen would refuse its own default.
   */
  const topUp = useAiTopUp({
    tokenPrice: aiTokenPrice(aiProduct?.payAsYouGoOption?.price, aiProduct?.unitSize),
    initial: 50,
  });

  /**
   * Every non-device product, entered with no options. A checkout session
   * describes the WHOLE target plan rather than a diff, so leaving these out
   * would activate a subscription with the AI assistants switched off. How each
   * is billed is the product's own decision — `payAsYouGoEnabled` is left out on
   * purpose, since asking for the meter on a product sold in advance is refused.
   */
  const otherProducts = useMemo<ProductCheckoutInput[]>(
    () => products.filter(p => p.name !== OpenframeProduct.MANAGED_DEVICES).map(p => ({ productName: p.name })),
    [products],
  );

  return {
    loading,
    deviceProduct,
    deviceSubscriptionProduct,
    showDeviceCard,
    showAiCard,
    deviceCount,
    deviceUpdates,
    setDeviceUpdates,
    topUp,
    packageUpdates: deviceUpdates?.packageUpdates ?? [],
    checkoutProducts: deviceUpdates?.checkout ? [deviceUpdates.checkout, ...otherProducts] : [],
    hasInvalidCustom: deviceUpdates != null && !deviceUpdates.valid,
    selectionTotal: deviceUpdates?.total ?? null,
    // Only when the AI product is for sale here: a catalog without it has no
    // balance to open, and the checkout must not carry an amount for it.
    tokenAmountUsd: showAiCard ? topUp.amountUsd : null,
  };
}
