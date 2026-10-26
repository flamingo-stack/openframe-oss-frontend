import { useQuery } from '@tanstack/react-query';
import { authApiClient } from '@/lib/auth-api-client';
import { isAuthErrorRef } from '@/lib/mobile-auth-return';

/**
 * What the error page shows when it has nothing better: no `ref`, a `ref` that is not a reference,
 * or a lookup that could not reach the auth server. The description is the server's own `UNEXPECTED`
 * sentence, so the fallback reads the same as the server's answer for an unknown reference.
 */
export const AUTH_ERROR_FALLBACK = {
  title: 'Oops, Something Went Wrong',
  description: 'An unexpected error occurred. Please try again or contact support if the problem persists.',
} as const;

export const authErrorMessageQueryKey = (ref: string) => ['auth-error-message', ref] as const;

export interface AuthErrorCopy {
  title: string;
  description: string;
  /** True while the lookup is in flight; the page holds the description back rather than flashing the fallback. */
  isLoading: boolean;
}

/**
 * Resolves the `ref` of `/auth/error` into the copy the page shows. Nothing from the URL reaches
 * the result: the description is the server's answer, or the fallback.
 */
export function useAuthErrorMessage(ref: string | null | undefined): AuthErrorCopy {
  const reference = isAuthErrorRef(ref) ? ref : null;
  const query = useQuery({
    queryKey: authErrorMessageQueryKey(reference ?? ''),
    queryFn: async () => {
      // `reference` is non-null whenever the query is enabled.
      const response = await authApiClient.authErrorMessage(reference ?? '');
      if (!response.ok || !response.data) {
        throw new Error(response.error || 'The error message could not be resolved');
      }
      return response.data;
    },
    enabled: reference !== null,
    // A terminal page: one attempt, then the generic text. Retrying would only hold the fallback back.
    retry: false,
    // A stored reference expires on the server; re-reading it later could only downgrade the text.
    staleTime: Infinity,
  });

  return {
    title: AUTH_ERROR_FALLBACK.title,
    description: query.data?.message ?? AUTH_ERROR_FALLBACK.description,
    isLoading: query.isLoading,
  };
}
