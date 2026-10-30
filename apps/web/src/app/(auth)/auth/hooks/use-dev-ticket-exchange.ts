import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { getLandingPath } from '@/lib/app-mode';
import { authApiClient } from '@/lib/auth-api-client';
import { markDevTicketSettled } from '@/lib/dev-ticket-pending';
import { authSessionQueryKey } from './use-auth-session';
import { useTokenStorage } from './use-token-storage';

/**
 * Hook for exchanging devTicket via API.
 * After successful exchange, triggers useAuthSession recheck
 */
export function useDevTicketExchange() {
  const { toast } = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { storeTokensFromHeaders } = useTokenStorage();

  const exchangeTicket = useCallback(
    async (ticket: string) => {
      try {
        const response = await authApiClient.devExchange(ticket);

        if (!response.ok) {
          throw new Error(`DevTicket exchange failed with status ${response.status}`);
        }

        const tokens = await storeTokensFromHeaders(response.headers);
        markDevTicketSettled(ticket);
        // The session check was held for this ticket: ask now, whatever the
        // exchange returned (useAuthSession syncs the user to the store). An
        // answer with no tokens must not leave the held "signed out" in place.
        await queryClient.invalidateQueries({ queryKey: authSessionQueryKey });

        if (tokens.accessToken || tokens.refreshToken) {
          toast({
            title: 'Welcome!',
            description: 'Successfully signed in',
            variant: 'success',
          });

          // replace, not push: don't leave the dev-ticket landing/auth screen in
          // the back stack after a successful login.
          router.replace(getLandingPath());
        }

        return {
          success: response.ok,
          status: response.status,
          tokens,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to exchange devTicket';

        // The session check was held for this ticket; it failed, so ask now
        // (a same-site deployment may still hold a cookie session).
        markDevTicketSettled(ticket);
        void queryClient.invalidateQueries({ queryKey: authSessionQueryKey });

        toast({
          title: 'Exchange Failed',
          description: message,
          variant: 'destructive',
        });

        return {
          success: false,
          status: 0,
          tokens: { accessToken: null, refreshToken: null },
        };
      }
    },
    [storeTokensFromHeaders, toast, queryClient, router],
  );

  return { exchangeTicket };
}
