'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useCallback } from 'react';
import { graphql, useMutation } from 'react-relay';
import type {
  CheckoutInput,
  ProductCheckoutInput,
  useCreateCheckoutSessionMutation as UseCreateCheckoutSessionMutationType,
} from '@/__generated__/useCreateCheckoutSessionMutation.graphql';
import { getRelayErrorCodes, getRelayErrorMessage } from '@/lib/handle-api-error';
import { openDeferredTab } from '../shared/stripe-window';

export type { CheckoutInput, ProductCheckoutInput };

/**
 * The tenant's cancelled pay-as-you-go subscription is still being closed in
 * Stripe, and a new one would share its usage meter. Gone within minutes.
 */
const PREVIOUS_SUBSCRIPTION_FINALIZING = 'PREVIOUS_SUBSCRIPTION_FINALIZING';

/**
 * An invoice of the tenant's is past its due date, and the backend starts no
 * new subscription over it. The paywall lists that invoice with its payment
 * link (`OutstandingInvoicesNotice`), so the toast points there.
 */
const OVERDUE_INVOICES_EXIST = 'OVERDUE_INVOICES_EXIST';

const createCheckoutSessionMutation = graphql`
  mutation useCreateCheckoutSessionMutation($input: CheckoutInput!) {
    createCheckoutSession(input: $input) {
      checkoutUrl
    }
  }
`;

/**
 * Starts a Stripe Checkout for the whole target plan — devices, the AI product,
 * and the first AI top-up (`tokenAmountUsd`), which is charged on the checkout's
 * own invoice.
 *
 * The Stripe tab is opened from the click, before the mutation answers: a tab
 * opened once the URL is in has lost the user gesture that lets it through the
 * popup blocker (see `openDeferredTab`). It is closed again if checkout fails.
 */
export function useCreateCheckoutSession() {
  const { toast } = useToast();
  const [commit, isInFlight] = useMutation<UseCreateCheckoutSessionMutationType>(createCheckoutSessionMutation);

  const mutate = useCallback(
    (input: CheckoutInput) => {
      const tab = openDeferredTab('Preparing checkout...');

      commit({
        variables: { input },
        onCompleted: response => {
          const url = response.createCheckoutSession?.checkoutUrl;
          if (!url) {
            tab.cancel();
            toast({
              title: 'Checkout Failed',
              description: 'No checkout URL was returned. Please try again later.',
              variant: 'destructive',
            });
            return;
          }
          toast({
            title: 'Checkout Opened',
            description: 'Complete your payment in the new tab to activate your subscription.',
            variant: 'success',
          });
          tab.navigate(url);
        },
        onError: err => {
          tab.cancel();
          const codes = getRelayErrorCodes(err);
          if (codes.includes(OVERDUE_INVOICES_EXIST)) {
            toast({
              title: 'Unpaid invoice',
              description: 'Pay the overdue invoice shown above, then choose your plan again.',
              variant: 'destructive',
            });
            return;
          }
          if (codes.includes(PREVIOUS_SUBSCRIPTION_FINALIZING)) {
            toast({
              title: 'Previous subscription is closing',
              description: 'Your previous subscription is still being finalized. Please try again in a few minutes.',
              variant: 'destructive',
            });
            return;
          }
          toast({
            title: 'Checkout Failed',
            description: getRelayErrorMessage(err, 'Failed to start checkout'),
            variant: 'destructive',
          });
        },
      });
    },
    [commit, toast],
  );

  return { mutate, isPending: isInFlight };
}
