'use client';

import { Suspense, useState } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { upgradePlanModalQuery as UpgradePlanModalQueryType } from '@/__generated__/upgradePlanModalQuery.graphql';
import { SimpleModal } from '@/app/components/shared/simple-modal';
import { OpenframeProduct } from '@/generated/schema-enums';
import { DevicePlanPicker } from './device-plan-picker';
import type { ProductUpdates } from './plan-selection';
import { SubscriptionSubmitButton } from './subscription-submit-button';

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

/** The loading frame reports nothing: there is no selection to submit yet. */
const NOOP_UPDATES = () => {};

interface UpgradePlanModalProps {
  isOpen: boolean;
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
 * The only place a LIVE plan is changed. `/settings/billing-usage/subscription`
 * is gone, so this is not a shortcut to a page that also exists — the same
 * `DevicePlanPicker` the subscription lock screen shows, in a modal, over its
 * own query. The query lives here rather than on the billing page because the
 * catalog and its prices are only worth fetching once someone opens this.
 *
 * Update flow only. A workspace with no paid subscription yet (a trial) does
 * not change a plan, it starts one — with the AI top-up the checkout requires,
 * which this picker has no control for. That is `ActivateSubscriptionModal`.
 */
export function UpgradePlanModal({ isOpen, onClose, onUpdated }: UpgradePlanModalProps) {
  const [updates, setUpdates] = useState<ProductUpdates | null>(null);

  // Nothing mounts — and no query runs — until the modal is actually opened.
  if (!isOpen) return null;

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
            needsCheckout={false}
            packageUpdates={updates?.packageUpdates ?? []}
            checkoutProducts={[]}
            hasInvalidCustom={updates != null && !updates.valid}
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
          <UpgradePlanBody onUpdatesChange={setUpdates} />
        </Suspense>
      </div>
    </SimpleModal>
  );
}

function UpgradePlanBody({ onUpdatesChange }: { onUpdatesChange: (updates: ProductUpdates) => void }) {
  const data = useLazyLoadQuery<UpgradePlanModalQueryType>(
    upgradePlanModalQuery,
    {},
    { fetchPolicy: 'store-and-network' },
  );

  const products = data.billingPlan?.products ?? [];
  const deviceProduct = products.find(p => p.name === OpenframeProduct.MANAGED_DEVICES) ?? null;
  const deviceSubscriptionProduct =
    data.subscription?.products.find(p => p.name === OpenframeProduct.MANAGED_DEVICES) ?? null;

  return (
    <DevicePlanPicker
      productRef={deviceProduct}
      subscriptionProductRef={deviceSubscriptionProduct}
      onUpdatesChange={onUpdatesChange}
    />
  );
}
