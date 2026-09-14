'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useCallback } from 'react';
import { graphql, useMutation } from 'react-relay';
import type {
  PackageUpdateInput,
  UpdateSubscriptionInput,
  useUpdateSubscriptionMutation as UseUpdateSubscriptionMutationType,
} from '@/__generated__/useUpdateSubscriptionMutation.graphql';
export type { PackageUpdateInput, UpdateSubscriptionInput };

const updateSubscriptionMutation = graphql`
  mutation useUpdateSubscriptionMutation($input: UpdateSubscriptionInput!) {
    updateSubscription(input: $input) {
      subscription {
        id
        status
        startDate
        currentPeriodEnd
        cancellationEffectiveAt
        pendingInvoices {
          id
          hostedInvoiceUrl
          createdAt
        }
      }
      errors {
        code
        message
        field
      }
    }
  }
`;

/**
 * What to do once the change lands. The hook itself does NOT navigate: it used
 * to `router.push` to Billing & Usage, which is a no-op when the mutation is
 * fired FROM that page — the Upgrade Plan modal stayed open over a page still
 * showing the old plan, because the response carries `status` and dates but not
 * `products { packageOptions }`, which is the part a plan change alters.
 * Each caller decides what "done" means for it.
 */
interface UpdateSubscriptionOptions {
  onSuccess?: () => void;
}

export function useUpdateSubscription() {
  const { toast } = useToast();
  const [commit, isInFlight] = useMutation<UseUpdateSubscriptionMutationType>(updateSubscriptionMutation);

  const mutate = useCallback(
    (input: UpdateSubscriptionInput, options?: UpdateSubscriptionOptions) => {
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

          // An upgrade may generate a pending invoice; a downgrade doesn't. We no
          // longer auto-open the invoice — use a neutral message that points the
          // user to the invoices list without asserting an invoice was created.
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
            description: err instanceof Error ? err.message : 'Failed to update subscription',
            variant: 'destructive',
          });
        },
      });
    },
    [commit, toast],
  );

  return { mutate, isPending: isInFlight };
}
