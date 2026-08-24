'use client';

import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { type ProductCheckoutInput, useCreateCheckoutSession } from '../hooks/use-create-checkout-session';
import { type PackageUpdateInput, useUpdateSubscription } from '../hooks/use-update-subscription';

interface SubscriptionSubmitButtonProps {
  /** TRIAL / TRIAL_EXPIRED / CANCELED → create a new subscription via Stripe Checkout. */
  needsCheckout: boolean;
  /** ADD/CANCEL diff for the update flow. */
  packageUpdates: PackageUpdateInput[];
  /** Desired end-state for the checkout flow. */
  checkoutProducts: ProductCheckoutInput[];
  /** True when a Custom Amount has an empty/invalid quantity. */
  hasInvalidCustom: boolean;
  /** Extra classes for the button (e.g. `w-full` for the mobile action bar). */
  className?: string;
}

/**
 * Renders the correct submit action for the current subscription state:
 * - no active paid subscription → "Proceed to Payment" (Stripe Checkout);
 *   disabled when there is nothing to buy, validated on click.
 * - active paid subscription → "Update Subscription"; disabled when the
 *   selection equals the current plan, validated on click.
 */
export function SubscriptionSubmitButton({
  needsCheckout,
  packageUpdates,
  checkoutProducts,
  hasInvalidCustom,
  className,
}: SubscriptionSubmitButtonProps) {
  const updateSubscription = useUpdateSubscription();
  const createCheckout = useCreateCheckoutSession();
  const { toast } = useToast();

  const isPending = updateSubscription.isPending || createCheckout.isPending;

  const invalidCustomToast = () => {
    toast({
      title: 'Invalid amount',
      description: 'Enter a valid number for the custom package.',
      variant: 'destructive',
    });
  };

  if (needsCheckout) {
    const handleCheckout = () => {
      if (hasInvalidCustom) {
        invalidCustomToast();
        return;
      }
      if (!checkoutProducts.length) return;
      createCheckout.mutate({ products: checkoutProducts });
    };

    return (
      <Button
        variant="accent"
        className={className}
        onClick={handleCheckout}
        loading={isPending}
        disabled={isPending || checkoutProducts.length === 0}
      >
        Proceed to Payment
      </Button>
    );
  }

  const handleUpdate = () => {
    if (hasInvalidCustom) {
      invalidCustomToast();
      return;
    }
    if (!packageUpdates.length) return;
    updateSubscription.mutate({ packageUpdates });
  };

  return (
    <Button
      variant="accent"
      className={className}
      onClick={handleUpdate}
      loading={isPending}
      disabled={isPending || packageUpdates.length === 0}
    >
      Update Subscription
    </Button>
  );
}
