'use client';

import { Card } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { devicePlanPickerProductFragment$key } from '@/__generated__/devicePlanPickerProductFragment.graphql';
import type { devicePlanPickerSubscriptionFragment$key } from '@/__generated__/devicePlanPickerSubscriptionFragment.graphql';
import type { ProductUpdates } from '../types/subscription.types';
import { DevicePlanPicker } from './device-plan-picker';

/**
 * Overage rule for the prepaid plan. Kept on the surface that can incur it (the
 * annual commitment) rather than in the page footer, where it used to sit before
 * the footer became the checkout total.
 */
const ADDITIONAL_DEVICES_HELPER_TEXT =
  'You can add more devices anytime. Additional devices beyond your prepaid count are charged at pay-as-you-go rates and added to your next invoice.';

interface DeviceManagementCardProps {
  /** `null` renders the loading state — the picker draws its own; see `DevicePlanPicker`. */
  productRef: devicePlanPickerProductFragment$key | null;
  subscriptionProductRef: devicePlanPickerSubscriptionFragment$key | null;
  /** Managed devices, counted by billing — prices the pay-as-you-go month. */
  deviceCount: number | null;
  onUpdatesChange: (updates: ProductUpdates) => void;
}

/**
 * The paywall's device plan card: a heading over `DevicePlanPicker`.
 *
 * Its own component rather than a `ProductSubscriptionCard` variant because the
 * two cards no longer share an interaction model — devices are a period toggle
 * over two priced panels, while the AI add-on stays a radio list of packages.
 * What they do share (the update diff and checkout end-state) lives in
 * `subscription.utils.ts` and is fed by both.
 */
export function DeviceManagementCard({
  productRef,
  subscriptionProductRef,
  deviceCount,
  onUpdatesChange,
}: DeviceManagementCardProps) {
  return (
    <Card className="relative flex flex-1 flex-col gap-6 border-ods-border bg-ods-bg p-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-ods-text-primary text-h2">Device Management</h2>
        <p className="text-ods-text-primary text-h4">
          Manage every device across your customers. Choose how you'd like to be billed.
        </p>
      </div>

      <DevicePlanPicker
        productRef={productRef}
        subscriptionProductRef={subscriptionProductRef}
        deviceCount={deviceCount}
        onUpdatesChange={onUpdatesChange}
        footerNote={ADDITIONAL_DEVICES_HELPER_TEXT}
      />
    </Card>
  );
}
