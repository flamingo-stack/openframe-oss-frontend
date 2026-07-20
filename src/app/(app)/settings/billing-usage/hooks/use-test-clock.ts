'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useCallback } from 'react';
import { commitLocalUpdate, graphql, useMutation, useRelayEnvironment } from 'react-relay';
import type { useTestClockAdvanceMutation as UseTestClockAdvanceMutationType } from '@/__generated__/useTestClockAdvanceMutation.graphql';
import type { useTestClockResetMutation as UseTestClockResetMutationType } from '@/__generated__/useTestClockResetMutation.graphql';

/**
 * Stripe test-clock mutations (dev/stage only — see `runtimeEnv.enableBillingTestClock`).
 * Both invalidate the Relay store on success: advancing the clock re-runs the tenant's
 * billing jobs and resetting deletes the Stripe customer, so subscription status, period
 * dates and invoices all change server-side without those fields being part of the
 * mutation payload.
 */

const advanceTestClockMutation = graphql`
  mutation useTestClockAdvanceMutation($days: Int!) {
    advanceTestClock(days: $days) {
      frozenTime
    }
  }
`;

const resetTestClockMutation = graphql`
  mutation useTestClockResetMutation {
    resetTestClock
  }
`;

export function useAdvanceTestClock() {
  const { toast } = useToast();
  const environment = useRelayEnvironment();
  const [commit, isInFlight] = useMutation<UseTestClockAdvanceMutationType>(advanceTestClockMutation);

  const mutate = useCallback(
    (days: number, onSuccess?: (frozenTime: string | null) => void) => {
      commit({
        variables: { days },
        onCompleted: response => {
          commitLocalUpdate(environment, store => store.invalidateStore());
          onSuccess?.(response.advanceTestClock?.frozenTime ?? null);
        },
        onError: err => {
          toast({
            title: 'Advance Failed',
            description: err instanceof Error ? err.message : 'Failed to advance the test clock',
            variant: 'destructive',
          });
        },
      });
    },
    [commit, toast, environment],
  );

  return { mutate, isPending: isInFlight };
}

export function useResetTestClock() {
  const { toast } = useToast();
  const environment = useRelayEnvironment();
  const [commit, isInFlight] = useMutation<UseTestClockResetMutationType>(resetTestClockMutation);

  const mutate = useCallback(
    (onSuccess?: () => void) => {
      commit({
        variables: {},
        onCompleted: () => {
          commitLocalUpdate(environment, store => store.invalidateStore());
          onSuccess?.();
        },
        onError: err => {
          toast({
            title: 'Reset Failed',
            description: err instanceof Error ? err.message : 'Failed to reset the test clock',
            variant: 'destructive',
          });
        },
      });
    },
    [commit, toast, environment],
  );

  return { mutate, isPending: isInFlight };
}
