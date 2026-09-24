'use client';

import { graphql, useFragment } from 'react-relay';
import type { planCheckoutCards_query$key } from '@/__generated__/planCheckoutCards_query.graphql';
import { OpenframeProduct } from '@/generated/schema-enums';
import { AiAssistantsIncludedNote } from './ai-assistants-included-note';
import { AiTokenBalanceCard } from './ai-token-balance-card';
import { DeviceManagementCard } from './device-management-card';
import type { PlanCheckout } from './use-plan-checkout';

/**
 * The device product's catalog entry, handed to the card that picks a plan from
 * it — and the subscription's own record of it, the package in force, which the
 * picker opens on. On the root type, because the cards read two roots and each
 * surface's query spreads them as one thing.
 */
const planCheckoutCardsFragment = graphql`
  fragment planCheckoutCards_query on Query {
    billingPlan {
      id
      products {
        id
        name
        ...deviceManagementCard_product
      }
    }
    subscription {
      id
      products {
        name
        ...deviceManagementCard_subscriptionProduct
      }
    }
  }
`;

interface PlanCheckoutCardsProps {
  /** `null` while the catalog is on its way — the cards draw their own pending state. */
  query: planCheckoutCards_query$key | null;
  form: PlanCheckout;
}

/**
 * The form's body: the note, then the device card beside the AI card.
 *
 * The lock screen and the Activate Subscription modal draw exactly this and
 * differ only in the frame around it and where the total and the button go
 * (see `usePlanCheckout`). A fragment, so each frame spaces it as its own
 * children.
 */
export function PlanCheckoutCards({ query, form }: PlanCheckoutCardsProps) {
  const data = useFragment(planCheckoutCardsFragment, query);

  const deviceProduct = data?.billingPlan?.products.find(p => p.name === OpenframeProduct.MANAGED_DEVICES) ?? null;
  const deviceSubscriptionProduct =
    data?.subscription?.products.find(p => p.name === OpenframeProduct.MANAGED_DEVICES) ?? null;

  return (
    <>
      {form.showAiCard && <AiAssistantsIncludedNote />}

      {/* `items-stretch`, not `items-start`: side by side, two cards of
          different heights read as one unfinished. Each card keeps its content
          top-aligned (they are `flex-col`), so the shorter one gains empty space
          at the bottom rather than stretched rows. */}
      <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
        {form.showDeviceCard && (
          <DeviceManagementCard
            product={deviceProduct}
            subscriptionProduct={deviceSubscriptionProduct}
            deviceCount={form.deviceCount}
            onUpdatesChange={form.setDeviceUpdates}
          />
        )}
        {form.showAiCard && (
          <AiTokenBalanceCard
            loading={form.loading}
            deviceMode={form.deviceUpdates?.mode ?? null}
            topUp={form.topUp}
            autoTopUp={form.autoTopUp}
            onAutoTopUpChange={form.setAutoTopUp}
          />
        )}
      </div>
    </>
  );
}
