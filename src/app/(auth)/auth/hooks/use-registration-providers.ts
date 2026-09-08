'use client';

import { useQuery } from '@tanstack/react-query';
import { authApiClient } from '@/lib/auth-api-client';

export interface SsoProvider {
  provider: string;
  enabled: boolean;
}

interface RegistrationProvidersResponse {
  providers: string[];
}

export const registrationProvidersQueryKey = ['auth', 'registration-providers'] as const;

/**
 * Which SSO providers the backend offers for registration.
 *
 * Cached rather than refetched per mount: the answer is fixed for the life of the page, and the
 * Sign Up tab unmounts whenever the user looks at Login. Without a cache, coming back re-ran the
 * request and the provider buttons popped in late every time — the visible half of a tab switch
 * feeling slow. React Query also dedups concurrent mounts, so this needs no in-flight bookkeeping
 * of its own.
 */
export function useRegistrationProviders() {
  const query = useQuery<SsoProvider[]>({
    queryKey: registrationProvidersQueryKey,
    queryFn: async () => {
      const response = await authApiClient.getRegistrationProviders<RegistrationProvidersResponse>();
      if (!response.ok || !response.data?.providers) {
        throw new Error(response.error || 'Failed to fetch providers');
      }
      return response.data.providers.map(provider => ({ provider, enabled: true }));
    },
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
    // No retry, matching what this replaced: the screen degrades to "no provider buttons", which
    // is a state the form handles, so a retry storm behind a rendered page buys nothing.
    retry: false,
  });

  return {
    providers: query.data ?? [],
    // `isPending`, not `isLoading` — the latter is `isPending && isFetching`, so it reads false
    // for a query that has not started. Same distinction `use-auth-session` documents.
    loading: query.isPending,
    error: query.error?.message ?? null,
  };
}
