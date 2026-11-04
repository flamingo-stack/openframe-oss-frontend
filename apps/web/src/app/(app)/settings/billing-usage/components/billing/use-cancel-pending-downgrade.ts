'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { graphql, useMutation } from 'react-relay';
import type { useCancelPendingDowngradeMutation as UseCancelPendingDowngradeMutationType } from '@/__generated__/useCancelPendingDowngradeMutation.graphql';

/**
 * Undoes a scheduled downgrade: the backend drops the staged package (or the
 * end date of a commitment lapsing to pay-as-you-go) and releases the Stripe
 * schedule, so the current plan simply renews. Selects no packages, for the
 * reason `useUpdateSubscription` gives: the page refetches via `onSettled`.
 */
const cancelPendingDowngradeMutation = graphql`
  mutation useCancelPendingDowngradeMutation {
    cancelPendingDowngrade {
      subscription {
        id
        status
      }
      errors {
        message
      }
    }
  }
`;

interface CancelPendingDowngradeOptions {
  /**
   * After either answer. A failure refetches too: the usual one is a page older
   * than the subscription (undone in another tab, or already in effect), which
   * would otherwise keep offering the undo it just refused.
   */
  onSettled?: () => void;
}

/**
 * Not the backend's text: it names the tenant id ("No pending downgrade to
 * cancel: <id>"). The refetch beside it shows what the plan actually is.
 */
const UNDO_FAILED = {
  title: 'Undo Failed',
  description: 'This downgrade may already be undone or in effect. The page now shows your current plan.',
  variant: 'destructive',
} as const;

export function useCancelPendingDowngrade() {
  const { toast } = useToast();
  const [commit, isInFlight] = useMutation<UseCancelPendingDowngradeMutationType>(cancelPendingDowngradeMutation);

  const mutate = (options?: CancelPendingDowngradeOptions) => {
    commit({
      variables: {},
      onCompleted: (response, errors) => {
        const userErrors = response.cancelPendingDowngrade?.errors ?? [];
        if (errors?.length || userErrors.length > 0) {
          console.error('cancelPendingDowngrade failed', [...(errors ?? []), ...userErrors]);
          toast(UNDO_FAILED);
        } else {
          toast({
            title: 'Downgrade Undone',
            description: 'Your current plan stays in place and renews as before.',
            variant: 'success',
          });
        }
        options?.onSettled?.();
      },
      onError: err => {
        console.error('cancelPendingDowngrade failed', err);
        toast(UNDO_FAILED);
        options?.onSettled?.();
      },
    });
  };

  return { mutate, isPending: isInFlight };
}
