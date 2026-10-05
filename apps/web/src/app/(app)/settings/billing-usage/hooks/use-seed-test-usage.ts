'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useCallback } from 'react';
import { commitLocalUpdate, graphql, useMutation, useRelayEnvironment } from 'react-relay';
import type { useSeedTestUsageMutation as UseSeedTestUsageMutationType } from '@/__generated__/useSeedTestUsageMutation.graphql';
import type { BillingMetricType } from '@/generated/schema-enums';
import { extractGraphqlErrorMessage } from './extract-graphql-error-message';

/**
 * Seeds synthetic billing usage (dev/stage only — the mutation is absent from the prod
 * schema, so callers stay behind the same `test-clock` feature flag as the panel).
 * Invalidates the Relay store on success: the seeded value changes the tenant's usage
 * aggregates server-side, so the usage cards on the page must re-request.
 */

const seedTestUsageMutation = graphql`
  mutation useSeedTestUsageMutation($metricType: BillingMetricType!, $value: Int!) {
    seedTestUsage(metricType: $metricType, value: $value) {
      metricType
      billingDate
      dayValue
    }
  }
`;

export interface SeedTestUsageResult {
  billingDate: string;
  dayValue: number;
}

export function useSeedTestUsage() {
  const { toast } = useToast();
  const environment = useRelayEnvironment();
  const [commit, isInFlight] = useMutation<UseSeedTestUsageMutationType>(seedTestUsageMutation);

  const mutate = useCallback(
    (metricType: BillingMetricType, value: number, onSuccess?: (result: SeedTestUsageResult) => void) => {
      commit({
        variables: { metricType, value },
        onCompleted: (response, errors) => {
          // A partial-error payload still lands here rather than in onError; treating
          // it as success would report seeding that never happened.
          if (errors?.length) {
            toast({
              title: 'Seeding Failed',
              description: errors.map(e => e.message).join('; '),
              variant: 'destructive',
            });
            return;
          }
          commitLocalUpdate(environment, store => store.invalidateStore());
          onSuccess?.({
            billingDate: response.seedTestUsage.billingDate,
            dayValue: response.seedTestUsage.dayValue,
          });
        },
        onError: err => {
          toast({
            title: 'Seeding Failed',
            description: extractGraphqlErrorMessage(err, 'Failed to seed test usage'),
            variant: 'destructive',
          });
        },
      });
    },
    [commit, toast, environment],
  );

  return { mutate, isPending: isInFlight };
}
