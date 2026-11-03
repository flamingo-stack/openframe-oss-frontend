'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { graphql, useMutation } from 'react-relay';
import type { useCancelPendingDowngradeMutation as UseCancelPendingDowngradeMutationType } from '@/__generated__/useCancelPendingDowngradeMutation.graphql';
import { getRelayErrorMessage } from '@/lib/handle-api-error';

/**
 * Undoes a scheduled downgrade: the backend drops the staged package (or the
 * end date of a commitment lapsing to pay-as-you-go) and releases the Stripe
 * schedule, so the current plan simply renews. Selects no packages, for the
 * reason `useUpdateSubscription` gives: the page refetches via `onSuccess`.
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
  onSuccess?: () => void;
}

export function useCancelPendingDowngrade() {
  const { toast } = useToast();
  const [commit, isInFlight] = useMutation<UseCancelPendingDowngradeMutationType>(cancelPendingDowngradeMutation);

  const mutate = (options?: CancelPendingDowngradeOptions) => {
    commit({
      variables: {},
      onCompleted: (response, errors) => {
        const userErrors = response.cancelPendingDowngrade?.errors ?? [];
        if (errors?.length || userErrors.length > 0) {
          toast({
            title: 'Undo Failed',
            description:
              [...(errors ?? []), ...userErrors].map(e => e.message).join('. ') || 'Failed to undo the downgrade',
            variant: 'destructive',
          });
          return;
        }
        toast({
          title: 'Downgrade Undone',
          description: 'Your current plan stays in place and renews as before.',
          variant: 'success',
        });
        options?.onSuccess?.();
      },
      onError: err => {
        toast({
          title: 'Undo Failed',
          description: getRelayErrorMessage(err, 'Failed to undo the downgrade'),
          variant: 'destructive',
        });
      },
    });
  };

  return { mutate, isPending: isInFlight };
}
