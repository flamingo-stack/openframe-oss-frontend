'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { graphql, useMutation } from 'react-relay';
import type {
  PackageUpdateInput,
  UpdateSubscriptionInput,
  useUpdateSubscriptionMutation as UseUpdateSubscriptionMutationType,
} from '@/__generated__/useUpdateSubscriptionMutation.graphql';
import { getRelayErrorMessage } from '@/lib/handle-api-error';

export type { PackageUpdateInput, UpdateSubscriptionInput };

/**
 * Applies a plan change in place.
 *
 * The response carries the status, which is what the app-wide guard reads to
 * unlock a workspace that paid from the lock screen. It deliberately does NOT
 * select `pendingInvoices`: Relay replaces the store's list with what a
 * mutation returns, and a shorter selection than the page's once left the
 * invoice an upgrade raised without its amount — the page rendered it from the
 * store before its refetch and went into its error boundary right after the
 * success toast. `products { packageOptions }`, which is what a plan change
 * actually alters, is not returned by the backend either; callers refetch.
 */
const updateSubscriptionMutation = graphql`
  mutation useUpdateSubscriptionMutation($input: UpdateSubscriptionInput!) {
    updateSubscription(input: $input) {
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

/**
 * What to do once the change lands. The hook itself does NOT navigate: it used
 * to `router.push` to Billing & Usage, which is a no-op when the mutation is
 * fired FROM that page. Each caller decides what "done" means for it.
 */
interface UpdateSubscriptionOptions {
  onSuccess?: () => void;
}

export function useUpdateSubscription() {
  const { toast } = useToast();
  const [commit, isInFlight] = useMutation<UseUpdateSubscriptionMutationType>(updateSubscriptionMutation);

  const mutate = (input: UpdateSubscriptionInput, options?: UpdateSubscriptionOptions) => {
    commit({
      variables: { input },
      onCompleted: response => {
        const result = response.updateSubscription;

        if (result.errors.length > 0) {
          toast({
            title: 'Update Failed',
            description: result.errors.map(e => e.message).join('. '),
            variant: 'destructive',
          });
          return;
        }

        // An upgrade may generate a pending invoice; a downgrade doesn't. A
        // neutral message points the user to the invoices list without
        // asserting an invoice was created.
        toast({
          title: 'Subscription Updated',
          description:
            'Your changes have been applied. Check the invoices list in Billing & Usage for any pending payments.',
          variant: 'success',
        });

        options?.onSuccess?.();
      },
      onError: err => {
        toast({
          title: 'Update Failed',
          description: getRelayErrorMessage(err, 'Failed to update subscription'),
          variant: 'destructive',
        });
      },
    });
  };

  return { mutate, isPending: isInFlight };
}
