'use client';

import { Suspense, useCallback, useMemo, useState } from 'react';
import { graphql, useFragment, useLazyLoadQuery } from 'react-relay';
import type { managedDevicesCountRelay_query$key as ManagedDevicesCountFragmentType } from '@/__generated__/managedDevicesCountRelay_query.graphql';
import type { upgradePlanModalQuery as UpgradePlanModalQueryType } from '@/__generated__/upgradePlanModalQuery.graphql';
import { DEFAULT_DEVICES_LIST_STATUSES } from '@/app/(app)/devices/constants/device-statuses';
import { SimpleModal } from '@/app/components/shared/simple-modal';
import { OpenframeProduct } from '@/generated/schema-enums';
import { managedDevicesCountFragment } from '@/graphql/devices/managed-devices-count-relay';
import type { RelayDeviceFilter } from '@/graphql/devices/to-relay-device-filter';
import { DevicePlanPicker } from '../subscription/components/device-plan-picker';
import { SubscriptionSubmitButton } from '../subscription/components/subscription-submit-button';
import type { ProductCheckoutInput } from '../subscription/hooks/use-create-checkout-session';
import type { ProductUpdates } from '../subscription/types/subscription.types';

/**
 * What the plan has to cover: the same online + offline fleet the Devices page
 * lists. Module-level so the query variables keep one identity across renders.
 */
const MANAGED_DEVICES_FILTER: RelayDeviceFilter = { statuses: [...DEFAULT_DEVICES_LIST_STATUSES] };
const UPGRADE_PLAN_VARIABLES = { deviceFilter: MANAGED_DEVICES_FILTER };

const upgradePlanModalQuery = graphql`
  query upgradePlanModalQuery($deviceFilter: DeviceFilterInput) {
    ...managedDevicesCountRelay_query @arguments(filter: $deviceFilter)
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
export function UpgradePlanModal({ isOpen, needsCheckout, onClose }: UpgradePlanModalProps) {
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
            className="flex-1"
          />
        </>
      }
    >
      <div className="flex flex-col gap-[var(--spacing-system-l)]">
        <p className="text-h4 text-ods-text-primary">Choose how you'd like to be billed.</p>
        {/* The picker draws its own pending state, so the wait shows the real
            controls rather than a spinner where the plan will be. */}
        <Suspense fallback={<UpgradePlanBodyFallback />}>
          <UpgradePlanBody onSelectionChange={setSelection} />
        </Suspense>
      </div>
    </SimpleModal>
  );
}

function UpgradePlanBodyFallback() {
  return (
    <DevicePlanPicker
      productRef={null}
      subscriptionProductRef={null}
      detectedDevices={null}
      onUpdatesChange={NOOP_UPDATES}
    />
  );
}

function UpgradePlanBody({ onSelectionChange }: { onSelectionChange: (selection: PlanSelection) => void }) {
  const data = useLazyLoadQuery<UpgradePlanModalQueryType>(upgradePlanModalQuery, UPGRADE_PLAN_VARIABLES, {
    fetchPolicy: 'store-and-network',
  });
  const deviceCount = useFragment<ManagedDevicesCountFragmentType>(managedDevicesCountFragment, data);

  const products = data.billingPlan?.products ?? [];
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
      detectedDevices={deviceCount?.devices.filteredCount ?? null}
      onUpdatesChange={handleUpdatesChange}
    />
  );
}
