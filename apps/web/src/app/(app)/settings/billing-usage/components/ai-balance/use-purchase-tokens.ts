'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useCallback } from 'react';
import { graphql, useMutation } from 'react-relay';
import type { usePurchaseTokensMutation as UsePurchaseTokensMutationType } from '@/__generated__/usePurchaseTokensMutation.graphql';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import { openDeferredTab } from '../shared/stripe-window';

/**
 * Tokens are credited only once the invoice this raises is paid, so the answer
 * that matters is `paymentUrl` — where the customer goes to pay it. Nothing in
 * the store changes on completion: the balance moves when the payment lands,
 * and the page reads it on its next fetch.
 */
const purchaseTokensMutation = graphql`
  mutation usePurchaseTokensMutation($amountUsd: Float!) {
    purchaseTokens(amountUsd: $amountUsd) {
      paymentUrl
    }
  }
`;

interface PurchaseTokensOptions {
  /** The invoice exists and its page is open. Callers in a modal close on this. */
  onSuccess?: () => void;
}

/**
 * Buys AI tokens for a whole number of dollars and sends the customer to the
 * invoice for them.
 *
 * The invoice tab is opened from the click, before the mutation answers, for
 * the same reason checkout does it (see `openDeferredTab`): a tab opened once
 * the response is in has lost the user gesture that lets it through the popup
 * blocker. It is closed again if the purchase is refused — which the backend
 * does below the configured minimum, and while the subscription itself is
 * blocked (past due, suspended, cancelled, an expired trial).
 */
export function usePurchaseTokens() {
  const { toast } = useToast();
  const [commit, isInFlight] = useMutation<UsePurchaseTokensMutationType>(purchaseTokensMutation);

  const mutate = useCallback(
    (amountUsd: number, options?: PurchaseTokensOptions) => {
      const tab = openDeferredTab();

      commit({
        variables: { amountUsd },
        onCompleted: response => {
          const url = response.purchaseTokens?.paymentUrl;
          if (!url) {
            tab.cancel();
            toast({
              title: 'Top-up Failed',
              description: 'No invoice was returned. Please try again later.',
              variant: 'destructive',
            });
            return;
          }
          toast({
            title: 'Invoice Opened',
            description: 'Pay the invoice in the new tab. Tokens are credited once it is paid.',
            variant: 'success',
          });
          tab.navigate(url);
          options?.onSuccess?.();
        },
        onError: err => {
          tab.cancel();
          toast({
            title: 'Top-up Failed',
            description: getRelayErrorMessage(err, 'Failed to buy AI tokens'),
            variant: 'destructive',
          });
        },
      });
    },
    [commit, toast],
  );

  return { mutate, isPending: isInFlight };
}
