'use client';

import { useState } from 'react';
import { graphql, useFragment } from 'react-relay';
import type { usePlanCheckout_query$key } from '@/__generated__/usePlanCheckout_query.graphql';
import { OpenframeProduct } from '@/generated/schema-enums';
import { type AiTopUp, useAiTopUp } from '../ai-balance/use-ai-top-up';
import { aiTokenPrice } from '../shared/ai-token-price';
import type { ProductUpdates, SelectionTotal } from './plan-selection';
import type { ProductCheckoutInput } from './use-create-checkout-session';
import type { PackageUpdateInput } from './use-update-subscription';

/**
 * What the form itself reads. Of the catalog: which products are for sale, and
 * AI's rate, which prices the top-up amounts (what $20 buys) — read through
 * `aiTokenPrice`. Of the subscription: the fleet size. The device picker reads
 * its own fragment, through the cards.
 *
 * On the root type, because the form reads two roots and each surface's query
 * spreads it as one thing.
 *
 * The fleet size comes from `subscription.usage` — NOT from the `devices()`
 * query it used to be spread from. That is app data: a locked workspace has it
 * refused with `SUBSCRIPTION_TRIAL_EXPIRED`, and because `devices` is non-null
 * the refusal nulled the whole payload and crashed the one screen a locked
 * workspace has to be able to render. The same count, counted by billing,
 * carries no such risk.
 *
 * NOT aiTokensFree either: that is the grant for the period the tenant is in
 * (5M on a trial), and this form previews the plan they are about to buy. See
 * `freeTokensForPlan` for what stands in until a prospective figure exists.
 */
const usePlanCheckoutFragment = graphql`
  fragment usePlanCheckout_query on Query {
    billingPlan {
      id
      products {
        id
        name
        ...aiTokenPrice_product
      }
    }
    subscription {
      id
      usage {
        activeDevices
      }
    }
  }
`;

export interface PlanCheckout {
  /** The catalog is on its way; every slot draws its own pending state. */
  loading: boolean;
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
  /**
   * Keep the bank topped up once the subscription is running. A switch and
   * nothing else: what it charges is the top-up above, and the level it fires
   * at is a fifth of that — set by the backend when the checkout completes, so
   * an abandoned checkout leaves no arrangement behind.
   */
  autoTopUp: boolean;
  setAutoTopUp: (enabled: boolean) => void;
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
 * with the same button: the device plan, the AI product, the first top-up and
 * whether it repeats, on one Stripe Checkout. So the choices and everything
 * derived from them live here, and each surface only decides where the total
 * and the button go.
 *
 * `null` while the surface's query is on its way: every slot draws its own
 * pending state.
 */
export function usePlanCheckout(query: usePlanCheckout_query$key | null): PlanCheckout {
  const data = useFragment(usePlanCheckoutFragment, query);
  const catalog = data?.billingPlan ?? null;
  const loading = catalog == null;
  const products = catalog?.products ?? [];

  const deviceProduct = products.find(p => p.name === OpenframeProduct.MANAGED_DEVICES) ?? null;
  const aiProduct = products.find(p => p.name === OpenframeProduct.AI_ASSISTANCE) ?? null;

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
    tokenPrice: aiTokenPrice(aiProduct),
    initial: 50,
  });
  const [autoTopUp, setAutoTopUp] = useState(false);

  /**
   * Every non-device product. A checkout session describes the WHOLE target
   * plan rather than a diff, so leaving these out would activate a subscription
   * with the AI assistants switched off.
   *
   * AI states its meter OFF rather than leaving the flag out. It is sold in
   * advance — the token bank — and asking for the meter there is refused
   * ("Sold in advance, so pay-as-you-go cannot be enabled: [AI_ASSISTANCE]"),
   * which is what a trial hit when this sent `true`. An explicit `false` also
   * does not depend on how the backend reads an absent flag. Any other product
   * is entered bare and decides for itself.
   */
  const otherProducts: ProductCheckoutInput[] = products
    .filter(p => p.name !== OpenframeProduct.MANAGED_DEVICES)
    .map(p =>
      p.name === OpenframeProduct.AI_ASSISTANCE
        ? { productName: p.name, payAsYouGoEnabled: false }
        : { productName: p.name },
    );

  return {
    loading,
    showDeviceCard,
    showAiCard,
    deviceCount,
    deviceUpdates,
    setDeviceUpdates,
    topUp,
    autoTopUp,
    setAutoTopUp,
    packageUpdates: deviceUpdates?.packageUpdates ?? [],
    checkoutProducts: deviceUpdates?.checkout ? [deviceUpdates.checkout, ...otherProducts] : [],
    hasInvalidCustom: deviceUpdates != null && !deviceUpdates.valid,
    selectionTotal: deviceUpdates?.total ?? null,
    // Only when the AI product is for sale here: a catalog without it has no
    // balance to open, and the checkout must not carry an amount for it.
    tokenAmountUsd: showAiCard ? topUp.amountUsd : null,
  };
}
