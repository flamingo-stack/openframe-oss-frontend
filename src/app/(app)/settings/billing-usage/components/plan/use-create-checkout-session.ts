'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useCallback } from 'react';
import { graphql, useMutation } from 'react-relay';
import type {
  CheckoutInput,
  ProductCheckoutInput,
  useCreateCheckoutSessionMutation as UseCreateCheckoutSessionMutationType,
} from '@/__generated__/useCreateCheckoutSessionMutation.graphql';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import { openDeferredTab } from '../shared/stripe-window';

export type { CheckoutInput, ProductCheckoutInput };

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
      const tab = openDeferredTab();

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
