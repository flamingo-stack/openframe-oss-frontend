'use client';

import { Card } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { deviceManagementCard_product$key } from '@/__generated__/deviceManagementCard_product.graphql';
import type { deviceManagementCard_subscriptionProduct$key } from '@/__generated__/deviceManagementCard_subscriptionProduct.graphql';
import { DevicePlanPicker } from './device-plan-picker';
import type { ProductUpdates } from './plan-selection';

/**
 * The card reads nothing of its own: it is a heading over the picker, and the
 * picker's fragments are spread here so the module that hands the refs down is
 * the one that renders their reader.
 */
const deviceManagementCardProductFragment = graphql`
  fragment deviceManagementCard_product on Product {
    ...devicePlanPickerProductFragment
  }
`;

const deviceManagementCardSubscriptionProductFragment = graphql`
  fragment deviceManagementCard_subscriptionProduct on SubscriptionProductDetail {
    ...devicePlanPickerSubscriptionFragment
  }
`;

/**
 * Overage rule for the prepaid plan. Kept on the surface that can incur it (the
 * annual commitment) rather than in the page footer, where it used to sit before
 * the footer became the checkout total.
 */
const ADDITIONAL_DEVICES_HELPER_TEXT =
  'You can add more devices anytime. Additional devices beyond your prepaid count are charged at pay-as-you-go rates and added to your next invoice.';

interface DeviceManagementCardProps {
  /** `null` renders the loading state — the picker draws its own; see `DevicePlanPicker`. */
  product: deviceManagementCard_product$key | null;
  subscriptionProduct: deviceManagementCard_subscriptionProduct$key | null;
  /** Managed devices, counted by billing — prices the pay-as-you-go month. */
  deviceCount: number | null;
  onUpdatesChange: (updates: ProductUpdates) => void;
}

/**
 * The paywall's device plan card: a heading over `DevicePlanPicker`.
 *
 * Its own component rather than a variant of the AI card because the two no
 * longer share an interaction model — devices are a period toggle over two
 * priced panels, while AI picks a balance.
 */
export function DeviceManagementCard({
  product,
  subscriptionProduct,
  deviceCount,
  onUpdatesChange,
}: DeviceManagementCardProps) {
  const productRef = useFragment(deviceManagementCardProductFragment, product);
  const subscriptionProductRef = useFragment(deviceManagementCardSubscriptionProductFragment, subscriptionProduct);

  return (
    <Card className="relative flex flex-1 flex-col gap-6 border-ods-border bg-ods-bg p-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-ods-text-primary text-h2">Device Management</h2>
        <p className="text-ods-text-primary text-h4">
          Manage every device across your customers. Choose how you'd like to be billed.
        </p>
      </div>

      <DevicePlanPicker
        productRef={productRef ?? null}
        subscriptionProductRef={subscriptionProductRef ?? null}
        deviceCount={deviceCount}
        onUpdatesChange={onUpdatesChange}
        footerNote={ADDITIONAL_DEVICES_HELPER_TEXT}
      />
    </Card>
  );
}
