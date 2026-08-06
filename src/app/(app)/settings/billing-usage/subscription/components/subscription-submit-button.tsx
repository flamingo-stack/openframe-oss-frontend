'use client';

import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { type ProductCheckoutInput, useCreateCheckoutSession } from '../hooks/use-create-checkout-session';
import { type PackageUpdateInput, useUpdateSubscription } from '../hooks/use-update-subscription';

/** The paywall's single CTA label, whichever action it ends up running. */
const SUBMIT_LABEL = 'Proceed to Payment';

interface SubscriptionSubmitButtonProps {
  /** TRIAL / TRIAL_EXPIRED / CANCELED → create a new subscription via Stripe Checkout. */
  needsCheckout: boolean;
  /** ADD/CANCEL diff for the update flow. */
  packageUpdates: PackageUpdateInput[];
  /** Desired end-state for the checkout flow. */
  checkoutProducts: ProductCheckoutInput[];
  /** True when a Custom Amount has an empty/invalid quantity (update flow only). */
  hasInvalidCustom: boolean;
  /**
   * The update landed. Only the update flow can call this — the checkout flow
   * leaves for Stripe and never comes back to this component.
   */
  onUpdated?: () => void;
  /** Extra classes for the button (e.g. `w-full` for the mobile action bar). */
  className?: string;
}

/**
 * One label — "Proceed to Payment" — over two different actions, per product
 * decision: the page is the paywall and its CTA reads the same everywhere.
 *
 * The ACTION still splits on the subscription state:
 * - no active paid subscription → `createCheckoutSession`, which redirects to
 *   Stripe. No diff gating: there is nothing to compare against.
 * - active paid subscription → `updateSubscription`, a mutation that applies the
 *   plan change in place and does NOT redirect to a payment page (an upgrade may
 *   raise an invoice afterwards). Disabled when the selection equals the current
 *   plan, validated on click.
 */
export function SubscriptionSubmitButton({
  needsCheckout,
  packageUpdates,
  checkoutProducts,
  hasInvalidCustom,
  onUpdated,
  className,
}: SubscriptionSubmitButtonProps) {
  const updateSubscription = useUpdateSubscription();
  const createCheckout = useCreateCheckoutSession();
  const { toast } = useToast();

  const isPending = updateSubscription.isPending || createCheckout.isPending;

  const rejectInvalidAmount = () => {
    toast({
      title: 'Invalid amount',
      description: 'Enter a valid number for the custom package.',
      variant: 'destructive',
    });
  };

  if (needsCheckout) {
    return (
      <Button
        variant="accent"
        className={className}
        onClick={() => {
          // Checkout has no diff to gate on, but an out-of-range quantity is still
          // one: it would be sent as a plan nobody can be billed for.
          if (hasInvalidCustom) {
            rejectInvalidAmount();
            return;
          }
          if (!checkoutProducts.length) return;
          createCheckout.mutate({ products: checkoutProducts });
        }}
        loading={isPending}
        disabled={isPending}
      >
        {SUBMIT_LABEL}
      </Button>
    );
  }

  const handleUpdate = () => {
    if (hasInvalidCustom) {
      rejectInvalidAmount();
      return;
    }
    if (!packageUpdates.length) return;
    updateSubscription.mutate({ packageUpdates }, { onSuccess: onUpdated });
  };

  return (
    <Button
      variant="accent"
      className={className}
      onClick={handleUpdate}
      loading={isPending}
      disabled={isPending || packageUpdates.length === 0}
    >
      {SUBMIT_LABEL}
    </Button>
  );
}
