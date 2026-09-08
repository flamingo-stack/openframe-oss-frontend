'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useCallback } from 'react';
import { graphql, useMutation } from 'react-relay';
import type { useUpdateAiSpendCapMutation as UseUpdateAiSpendCapMutationType } from '@/__generated__/useUpdateAiSpendCapMutation.graphql';

/**
 * The response is a `SubscriptionDetail` with its `id`, so Relay normalises the
 * new cap straight into the record every other surface reads. Nothing here has
 * to refetch, and no caller has to thread the value back up.
 */
const updateAiSpendCapMutation = graphql`
  mutation useUpdateAiSpendCapMutation($amountUsd: Float) {
    updateAiSpendCap(amountUsd: $amountUsd) {
      id
      aiSpendCapUsd
    }
  }
`;

interface UpdateAiSpendCapOptions {
  /** The cap is stored. Callers that edit it in a modal close on this. */
  onSuccess?: () => void;
  /** The server refused the change — the caller restores what it was showing. */
  onError?: () => void;
}

/**
 * Sets the ceiling, in USD, on the AI overage one billing period may accrue.
 *
 * `null` is not "no change": it is how the schema expresses "no cap at all", so
 * it is what clearing the limit sends. `0` is a real cap — nothing beyond the
 * free tokens — which is why the argument is `number | null` and never a falsy
 * check.
 *
 * Usable while AI is blocked, by backend contract: a tenant that hit its own
 * ceiling has to be able to raise it.
 */
export function useUpdateAiSpendCap() {
  const { toast } = useToast();
  const [commit, isInFlight] = useMutation<UseUpdateAiSpendCapMutationType>(updateAiSpendCapMutation);

  const mutate = useCallback(
    (amountUsd: number | null, options?: UpdateAiSpendCapOptions) => {
      commit({
        variables: { amountUsd },
        onCompleted: () => {
          toast({
            title: amountUsd == null ? 'Spending Limit Removed' : 'Spending Limit Set',
            description:
              amountUsd == null
                ? 'AI usage is no longer capped for this workspace.'
                : 'AI pauses for the rest of the cycle once this is reached.',
            variant: 'success',
          });
          options?.onSuccess?.();
        },
        onError: err => {
          toast({
            title: 'Limit Not Saved',
            description: err instanceof Error ? err.message : 'Failed to update the AI spending limit',
            variant: 'destructive',
          });
          options?.onError?.();
        },
      });
    },
    [commit, toast],
  );

  return { mutate, isPending: isInFlight };
}
