'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useCallback } from 'react';
import { graphql, useMutation } from 'react-relay';
import type {
  CheckoutInput,
  ProductCheckoutInput,
  useCreateCheckoutSessionMutation as UseCreateCheckoutSessionMutationType,
} from '@/__generated__/useCreateCheckoutSessionMutation.graphql';
import { type DeferredTab, openDeferredTab } from '../../lib/stripe-window';

export type { CheckoutInput, ProductCheckoutInput };

const createCheckoutSessionMutation = graphql`
  mutation useCreateCheckoutSessionMutation($input: CheckoutInput!) {
    createCheckoutSession(input: $input) {
      checkoutUrl
    }
  }
`;

interface CreateCheckoutSessionOptions {
  /**
   * A tab the caller already opened, for Stripe to be shown in.
   *
   * Passed in rather than opened here because this mutation does not always run
   * from the click that started it — the paywall stores the AI spending cap
   * first and calls this from its callback, by which point the user gesture is
   * gone and any tab opened would be a blocked popup. Omit it when `mutate` IS
   * called straight from a handler and one is opened here instead.
   */
  target?: DeferredTab;
}

export function useCreateCheckoutSession() {
  const { toast } = useToast();
  const [commit, isInFlight] = useMutation<UseCreateCheckoutSessionMutationType>(createCheckoutSessionMutation);

  const mutate = useCallback(
    (input: CheckoutInput, options?: CreateCheckoutSessionOptions) => {
      const tab = options?.target ?? openDeferredTab();

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
            description: err instanceof Error ? err.message : 'Failed to start checkout',
            variant: 'destructive',
          });
        },
      });
    },
    [commit, toast],
  );

  return { mutate, isPending: isInFlight };
}
