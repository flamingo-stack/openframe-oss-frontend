'use client';

import { Suspense, useCallback, useMemo, useState } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { upgradePlanModalQuery as UpgradePlanModalQueryType } from '@/__generated__/upgradePlanModalQuery.graphql';
import { SimpleModal } from '@/app/components/shared/simple-modal';
import { OpenframeProduct } from '@/generated/schema-enums';
import { DevicePlanPicker } from '../subscription/components/device-plan-picker';
import { SubscriptionSubmitButton } from '../subscription/components/subscription-submit-button';
import type { ProductCheckoutInput } from '../subscription/hooks/use-create-checkout-session';
import type { ProductUpdates } from '../subscription/types/subscription.types';

const upgradePlanModalQuery = graphql`
  query upgradePlanModalQuery {
    billingPlan {
      id
      products {
        id
        name
        ...devicePlanPickerProductFragment
      }
    }
    subscription {
      id
      products {
        name
        ...devicePlanPickerSubscriptionFragment
      }
    }
  }
`;

/** What the picker reports up, plus what has to ride along into a checkout session. */
interface PlanSelection {
  updates: ProductUpdates;
  /**
   * Every non-device product, as pay-as-you-go. A checkout session describes the
   * WHOLE target plan, not a diff, so leaving these out would activate a
   * subscription with the AI assistants switched off. They are metered-only, so
   * "pay as you go" is their entire configuration — the same entry the paywall's
   * AI card contributes.
   */
  otherProducts: ProductCheckoutInput[];
}

/** The loading frame reports nothing: there is no selection to submit yet. */
const NOOP_UPDATES = () => {};

interface UpgradePlanModalProps {
  isOpen: boolean;
  /**
   * No active paid subscription (trial, expired trial, canceled) → the submit
   * creates one through Stripe Checkout instead of updating in place. A boolean
   * rather than the status itself: the caller already reads the status, and the
   * two enums in play here (Relay's, with its `%future added value`, and the
   * generated one) do not agree on a type.
   */
  needsCheckout: boolean;
  onClose: () => void;
  /**
   * The plan change was applied. The page has to refetch: the mutation answers
   * with the subscription's status and dates, but the plan itself lives in
   * `products { packageOptions }`, which it does not return.
   */
  onUpdated: () => void;
}

/**
 * Changing the device plan, in place on the billing page.
 *
 * The only place a plan is changed. `/settings/billing-usage/subscription` is
 * gone, so this is not a shortcut to a page that also exists — the same
 * `DevicePlanPicker` the subscription lock screen shows, in a modal, over its
 * own query. The query lives here rather than on the billing page because the
 * catalog, its prices and the device count are only worth fetching once someone
 * opens this.
 */
export function UpgradePlanModal({ isOpen, needsCheckout, onClose, onUpdated }: UpgradePlanModalProps) {
  const [selection, setSelection] = useState<PlanSelection | null>(null);

  // Nothing mounts — and no query runs — until the modal is actually opened.
  if (!isOpen) return null;

  const checkoutProducts = selection ? [selection.updates.checkout, ...selection.otherProducts] : [];

  return (
    <SimpleModal
      isOpen
      onClose={onClose}
      title="Upgrade Plan"
      className="md:max-w-[600px]"
      footer={
        <>
          {/* Figma splits the footer into two halves and leaves the left one
              empty, so the button fills the right half rather than hugging its
              label. `ModalV2Footer` is a bare `flex`, so the spacer is ours. */}
          <div className="flex-1" />
          <SubscriptionSubmitButton
            needsCheckout={needsCheckout}
            packageUpdates={selection?.updates.packageUpdates ?? []}
            checkoutProducts={checkoutProducts}
            hasInvalidCustom={selection != null && !selection.updates.valid}
            onUpdated={onUpdated}
            className="flex-1"
          />
        </>
      }
    >
      <div className="flex flex-col gap-[var(--spacing-system-l)]">
        <p className="text-ods-text-primary text-h4">Choose how you'd like to be billed.</p>
        {/* The picker draws its own pending state, so the wait shows the real
            controls rather than a spinner where the plan will be — the same
            component, with no refs to read yet. */}
        <Suspense
          fallback={<DevicePlanPicker productRef={null} subscriptionProductRef={null} onUpdatesChange={NOOP_UPDATES} />}
        >
          <UpgradePlanBody onSelectionChange={setSelection} />
        </Suspense>
      </div>
    </SimpleModal>
  );
}

function UpgradePlanBody({ onSelectionChange }: { onSelectionChange: (selection: PlanSelection) => void }) {
  const data = useLazyLoadQuery<UpgradePlanModalQueryType>(
    upgradePlanModalQuery,
    {},
    { fetchPolicy: 'store-and-network' },
  );

  // Memoized: the `?? []` fallback is a new array on every render, and
  // `otherProducts` below depends on it.
  const products = useMemo(() => data.billingPlan?.products ?? [], [data.billingPlan]);
  const deviceProduct = products.find(p => p.name === OpenframeProduct.MANAGED_DEVICES) ?? null;
  const deviceSubscriptionProduct =
    data.subscription?.products.find(p => p.name === OpenframeProduct.MANAGED_DEVICES) ?? null;

  const otherProducts = useMemo<ProductCheckoutInput[]>(
    () =>
      products
        .filter(p => p.name !== OpenframeProduct.MANAGED_DEVICES)
        .map(p => ({ productName: p.name, payAsYouGoEnabled: true })),
    [products],
  );

  const handleUpdatesChange = useCallback(
    (updates: ProductUpdates) => onSelectionChange({ updates, otherProducts }),
    [onSelectionChange, otherProducts],
  );

  return (
    <DevicePlanPicker
      productRef={deviceProduct}
      subscriptionProductRef={deviceSubscriptionProduct}
      onUpdatesChange={handleUpdatesChange}
    />
  );
}
