'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useCallback } from 'react';
import { graphql, useMutation } from 'react-relay';
import type { useBillingPortalSessionMutation as UseBillingPortalSessionMutationType } from '@/__generated__/useBillingPortalSessionMutation.graphql';
import { openDeferredTab } from '../lib/stripe-window';

// Stripe hosts the portal, so the destination cannot be a link: the session is
// minted per click and expires, which is why this is a MUTATION and the menu
// item runs it and then navigates, rather than pointing an <a> anywhere.
//
// The portal covers billing address, tax IDs, payment methods and invoice
// history. It deliberately does NOT expose cancelling or changing the plan —
// those stay in this app (`cancelSubscription` / `updateSubscription`).
const createBillingPortalSessionMutation = graphql`
  mutation useBillingPortalSessionMutation {
    createBillingPortalSession {
      portalUrl
    }
  }
`;

export function useBillingPortalSession() {
  const { toast } = useToast();
  const [commit, isInFlight] = useMutation<UseBillingPortalSessionMutationType>(createBillingPortalSessionMutation);

  const mutate = useCallback(() => {
    // Opened here, while the click is still live — the URL is minted by the
    // mutation below and a tab opened once it answers is a blocked popup.
    const tab = openDeferredTab();

    commit({
      variables: {},
      onCompleted: (response, errors) => {
        const url = response.createBillingPortalSession?.portalUrl;
        if (errors?.length || !url) {
          tab.cancel();
          toast({
            title: 'Customer Portal Unavailable',
            description:
              errors?.map(e => e.message).join('. ') || 'No portal URL was returned. Please try again later.',
            variant: 'destructive',
          });
          return;
        }
        tab.navigate(url);
      },
      onError: err => {
        tab.cancel();
        toast({
          title: 'Customer Portal Unavailable',
          description: err instanceof Error ? err.message : 'Failed to open the customer portal',
          variant: 'destructive',
        });
      },
    });
  }, [commit, toast]);

  return { mutate, isPending: isInFlight };
}
