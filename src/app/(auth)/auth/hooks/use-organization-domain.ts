'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useCallback, useState } from 'react';
import { AUTH_ERROR_CODE } from '@/app/(auth)/auth/constants/auth-error-codes';
import { sanitizeSubdomain } from '@/app/(auth)/auth/constants/registration-validation';
import { useDomainAvailability } from '@/app/(auth)/auth/hooks/use-registration-availability';
import { isSharedAuthUi } from '@/lib/app-mode';
import { authApiClient, SAAS_DOMAIN_SUFFIX } from '@/lib/auth-api-client';

type StatusVariant = 'error' | 'warning' | 'success' | 'muted';

export interface OrganizationDomainState {
  domain: string;
  /** Sanitizing setter — subdomains accept only lowercase letters, digits and dashes. */
  setDomain: (value: string) => void;
  /** True while the debounced check says the subdomain is taken or still resolving. */
  isBlocked: boolean;
  /** True during the submit-time re-check, for the button's busy state. */
  isChecking: boolean;
  statusMessage: { message: string; variant: StatusVariant } | undefined;
  suggestions: string[];
  /**
   * Submit-time availability check. The debounced status can be stale by the time the button is
   * pressed, and on the native Apple path losing that race costs a single-use authorization code.
   * Resolves the full tenant domain on success, or `null` when the caller must not proceed —
   * every "don't proceed" case has already been surfaced to the user.
   */
  confirmAvailability: () => Promise<string | null>;
}

/**
 * The organization subdomain field, shared by every screen that creates a tenant: the password
 * signup, the web SSO continue page, and the native Apple signup.
 *
 * All three ask exactly the same question and must answer it identically — including the
 * cluster-capacity case, which is not a "pick another name" error and was previously handled on
 * only one of the three.
 */
export function useOrganizationDomain(organizationName: string): OrganizationDomainState {
  const { toast } = useToast();
  const isSharedAuth = isSharedAuthUi();

  const [domain, setDomainState] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [submitSuggestions, setSubmitSuggestions] = useState<string[]>([]);

  const { status, suggestions: liveSuggestions } = useDomainAvailability(domain, organizationName, isSharedAuth);

  const setDomain = useCallback(
    (value: string) => {
      setDomainState(isSharedAuth ? sanitizeSubdomain(value) : value);
      setSubmitSuggestions([]);
    },
    [isSharedAuth],
  );

  const confirmAvailability = useCallback(async (): Promise<string | null> => {
    const subdomain = domain.trim();
    if (!isSharedAuth) return subdomain;

    setIsChecking(true);
    try {
      const response = await authApiClient.checkDomainAvailability(subdomain, organizationName.trim());

      if (!response.ok) {
        const errorData = response.data as { code?: string; message?: string } | undefined;
        // 409 TENANT_REGISTRATION_BLOCKED — no cluster capacity for new tenants. Distinct from a
        // taken subdomain: picking another name will not help.
        if (response.status === 409 && errorData?.code === AUTH_ERROR_CODE.TENANT_REGISTRATION_BLOCKED) {
          toast({
            title: 'Registration Unavailable',
            description:
              errorData.message ||
              'Registration is currently unavailable because there is no cluster capacity. Please contact your administrator or try again later.',
            variant: 'destructive',
          });
          return null;
        }
        throw new Error(response.error || 'Failed to check domain availability');
      }

      const { available, suggestedUrl } = (response.data ?? {}) as {
        available?: boolean;
        suggestedUrl?: string[];
      };
      // A 2xx with no parsable `available` is a transport or serialisation problem, not a verdict.
      // Folding it into the `!available` branch would tell the user their name is taken and send
      // them off to rename an organization that was never actually checked.
      if (typeof available !== 'boolean') {
        throw new Error('Failed to check domain availability');
      }
      if (!available) {
        toast({
          title: 'Domain Not Available',
          description: `The subdomain '${subdomain}' is already taken. Please try another one.`,
          variant: 'destructive',
        });
        if (suggestedUrl?.length) {
          setSubmitSuggestions(suggestedUrl.map(url => url.replace(`.${SAAS_DOMAIN_SUFFIX}`, '')));
        }
        return null;
      }

      return `${subdomain}.${SAAS_DOMAIN_SUFFIX}`;
    } catch (error) {
      console.error('Domain check error:', error);
      toast({
        title: 'Error',
        description: 'Failed to check domain availability. Please try again.',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsChecking(false);
    }
  }, [domain, isSharedAuth, organizationName, toast]);

  const statusMessage =
    !isSharedAuth || !domain.trim()
      ? undefined
      : status === 'checking'
        ? { message: 'Checking availability…', variant: 'muted' as const }
        : status === 'taken'
          ? { message: 'This domain is already taken. Please try another one.', variant: 'error' as const }
          : status === 'available'
            ? { message: 'Domain is available', variant: 'success' as const }
            : undefined;

  return {
    domain,
    setDomain,
    isBlocked: isSharedAuth && (status === 'taken' || status === 'checking'),
    isChecking,
    statusMessage,
    // Prefer live suggestions from the debounced check; fall back to the submit-time ones.
    suggestions: isSharedAuth ? (liveSuggestions.length > 0 ? liveSuggestions : submitSuggestions) : [],
    confirmAvailability,
  };
}
