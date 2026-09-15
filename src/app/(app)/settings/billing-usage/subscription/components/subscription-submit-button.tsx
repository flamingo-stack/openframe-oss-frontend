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
  /** True when a Custom Amount has an empty/invalid quantity. */
  hasInvalidCustom: boolean;
  /**
   * The AI top-up to charge on the checkout, in whole dollars
   * (`CheckoutInput.tokenAmountUsd`). Checkout flow only — an existing
   * subscription tops up from the billing page instead. `null` sends none,
   * which the backend accepts only when it is configured not to require one.
   */
  tokenAmountUsd?: number | null;
  /**
   * The top-up's own check (`AiTopUp.validate`): reveals the problem under the
   * fields and returns it, or `null` when the amount can go. Checkout flow only.
   */
  validateTopUp?: () => string | null;
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
 *   Stripe. No diff gating: there is nothing to compare against. The AI top-up
 *   rides along on the same input and lands on the same invoice. Disabled only
 *   while there is nothing to buy yet — the picker has not reported (catalog
 *   still loading), or the catalog has no device product — because a button
 *   that looks live and does nothing on click is a dead end with no spinner,
 *   toast or redirect to say so.
 * - active paid subscription → `updateSubscription`, a mutation that applies the
 *   plan change in place and does NOT redirect to a payment page (an upgrade may
 *   raise an invoice afterwards). Disabled when the selection equals the current
 *   plan, validated on click.
 *
 * A bad amount — a device count under the floor, a top-up under its minimum —
 * never disables the button. It is pressed, and the press says what is wrong:
 * in the form, next to the field, and in a toast for a form scrolled out of
 * view. A locked button would leave the user to guess which of the two cards
 * is refusing.
 */
export function SubscriptionSubmitButton({
  needsCheckout,
  packageUpdates,
  checkoutProducts,
  hasInvalidCustom,
  tokenAmountUsd = null,
  validateTopUp,
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

  const rejectInvalidTopUp = (problem: string) => {
    toast({ title: 'Check the AI top-up', description: problem, variant: 'destructive' });
  };

  if (needsCheckout) {
    const handleCheckout = () => {
      // Checkout has no diff to gate on, but an out-of-range quantity is still
      // one: it would be sent as a plan nobody can be billed for. The same
      // goes for a top-up with no figure behind it.
      if (hasInvalidCustom) {
        rejectInvalidAmount();
        return;
      }
      const topUpProblem = validateTopUp?.() ?? null;
      if (topUpProblem != null) {
        rejectInvalidTopUp(topUpProblem);
        return;
      }
      createCheckout.mutate({ products: checkoutProducts, tokenAmountUsd: tokenAmountUsd ?? undefined });
    };

    return (
      <Button
        variant="accent"
        className={className}
        onClick={handleCheckout}
        loading={isPending}
        disabled={isPending || checkoutProducts.length === 0}
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
