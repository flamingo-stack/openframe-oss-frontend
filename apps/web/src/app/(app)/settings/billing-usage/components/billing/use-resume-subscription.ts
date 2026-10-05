'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useCallback } from 'react';
import { commitLocalUpdate, graphql, useMutation, useRelayEnvironment } from 'react-relay';
import type { useResumeSubscriptionMutation as UseResumeSubscriptionMutationType } from '@/__generated__/useResumeSubscriptionMutation.graphql';
import { getRelayErrorMessage } from '@/lib/handle-api-error';

// Clears a scheduled cancellation (status PENDING_CANCELLATION) in Stripe so the
// subscription renews again. Only valid while still inside the paid period — a
// fully canceled subscription must go through checkout instead. Takes no input
// and returns a Boolean, so the Relay store can't auto-update: the store is
// invalidated on success (see below) and the page refetches via `onSuccess`.
const resumeSubscriptionMutation = graphql`
  mutation useResumeSubscriptionMutation {
    resumeSubscription
  }
`;

interface ResumeSubscriptionOptions {
  onSuccess?: () => void;
}

export function useResumeSubscription() {
  const { toast } = useToast();
  const environment = useRelayEnvironment();
  const [commit, isInFlight] = useMutation<UseResumeSubscriptionMutationType>(resumeSubscriptionMutation);

  const mutate = useCallback(
    (options?: ResumeSubscriptionOptions) => {
      const { onSuccess } = options ?? {};
      commit({
        variables: {},
        onCompleted: (response, errors) => {
          if (errors?.length || !response.resumeSubscription) {
            toast({
              title: 'Renew Failed',
              description: errors?.map(e => e.message).join('. ') || 'Failed to renew subscription',
              variant: 'destructive',
            });
            return;
          }
          // The status went from PENDING_CANCELLATION back to ACTIVE server-side
          // and nothing in the payload says so. Invalidate the store so every
          // subscription-derived query (billing page, lock guard, balance bars)
          // refetches on its next read instead of serving the cancelled state —
          // the same step useCancelSubscription takes in the other direction.
          commitLocalUpdate(environment, store => store.invalidateStore());
          toast({
            title: 'Subscription Renewed',
            description: 'Your subscription will continue and the scheduled cancellation was removed.',
            variant: 'success',
          });
          onSuccess?.();
        },
        onError: err => {
          toast({
            title: 'Renew Failed',
            description: getRelayErrorMessage(err, 'Failed to renew subscription'),
            variant: 'destructive',
          });
        },
      });
    },
    [commit, toast, environment],
  );

  return { mutate, isPending: isInFlight };
}
