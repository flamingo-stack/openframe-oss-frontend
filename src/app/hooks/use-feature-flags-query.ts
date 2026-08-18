'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { subscribeConnectivity } from '@/lib/connectivity';
import { FEATURE_FLAG_NAMES } from '@/lib/feature-flags';
import { detectTrialExpiredFromGraphqlErrors } from '@/lib/subscription-lock-signal';
import { type FeatureFlag, useFeatureFlagsStore } from '@/stores/feature-flags-store';

const FE_FEATURE_FLAGS_QUERY = `
  query FeFeatureFlags($names: [String!]) {
    feFeatureFlags(names: $names) {
      name
      enabled
    }
  }
`;

export const featureFlagsQueryKey = ['featureFlags'] as const;

interface FeFeatureFlagsResponse {
  data?: {
    feFeatureFlags: FeatureFlag[];
  };
  errors?: Array<{ message: string; extensions?: { classification?: string } | null }>;
}

export function useFeatureFlagsQuery({ enabled }: { enabled: boolean }) {
  const setFlags = useFeatureFlagsStore(s => s.setFlags);
  const setLoaded = useFeatureFlagsStore(s => s.setLoaded);

  const query = useQuery<FeatureFlag[]>({
    queryKey: featureFlagsQueryKey,
    queryFn: async () => {
      const response = await apiClient.post<FeFeatureFlagsResponse>(
        '/api/graphql',
        {
          query: FE_FEATURE_FLAGS_QUERY,
          variables: { names: [...FEATURE_FLAG_NAMES] },
        },
        // Bootstrap call: it runs as soon as the session resolves and must not
        // wait on the session latch, which app data requests block on.
        { skipSessionGate: true },
      );

      detectTrialExpiredFromGraphqlErrors(response.data?.errors);

      if (!response.ok || response.data?.errors?.length) {
        const errorMessage = response.data?.errors?.[0]?.message || response.error || 'Failed to fetch feature flags';
        throw new Error(errorMessage);
      }

      return response.data?.data?.feFeatureFlags ?? [];
    },
    enabled,
    retry: 1,
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (query.data) {
      setFlags(query.data);
    }
  }, [query.data, setFlags]);

  useEffect(() => {
    if (query.isError) {
      console.error('[FeatureFlags] Failed to fetch feature flags, using defaults:', query.error);
      setLoaded();
    }
  }, [query.isError, query.error, setLoaded]);

  // Offline counts as "answered with defaults" too.
  //
  // This gate is a hard dependency for `useFeatureFlagGate`, and four routes
  // render nothing but a skeleton until it resolves — /notifications,
  // /settings/billing-usage, its /subscription child, and /mingo. It used to
  // resolve offline by accident: the query FAILED, so the `isError` branch above
  // fired. With a real connectivity signal it no longer fails, and those routes
  // skeletoned forever.
  //
  // Keyed off CONNECTIVITY, not `query.isPaused`: this query is `enabled`-gated on
  // the session, `/me` is itself paused offline, and query-core only assigns
  // `fetchStatus: 'paused'` to a query that was allowed to start
  // (`shouldLoadOnMount` requires `enabled !== false`). A disabled query is never
  // paused, so reading `isPaused` here would never fire.
  //
  // Flags have safe defaults; not knowing them is no reason to withhold the page.
  useEffect(
    () =>
      subscribeConnectivity(online => {
        if (!online) setLoaded();
      }),
    [setLoaded],
  );

  return query;
}
