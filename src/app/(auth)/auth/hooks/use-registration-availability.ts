'use client';

import { useDebounce } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useEffect, useState } from 'react';
import { isTenantRegistrationBlocked } from '@/app/(auth)/auth/constants/auth-error-codes';
import { authApiClient, SAAS_DOMAIN_SUFFIX } from '@/lib/auth-api-client';

export type AvailabilityStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'taken'
  | 'blocked'
  | 'registration-blocked'
  | 'error';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const BLOCKED_EMAIL_DOMAIN_MESSAGE =
  'Disposable and privacy-focused email providers are not allowed. Please use your work or personal email.';

/** Fallback capacity message when the backend sends none with the 409. */
export const REGISTRATION_BLOCKED_MESSAGE =
  'Registration is temporarily unavailable because there is no cluster capacity. Please try again in about 10 minutes.';

/** Debounced check of whether an email is already registered. Runs only on valid email format. */
export function useEmailAvailability(email: string, delay = 400): AvailabilityStatus {
  const debounced = useDebounce(email.trim(), delay);
  const [status, setStatus] = useState<AvailabilityStatus>('idle');

  useEffect(() => {
    if (!debounced || !EMAIL_REGEX.test(debounced)) {
      setStatus('idle');
      return;
    }

    let cancelled = false;
    setStatus('checking');

    authApiClient
      .checkEmailAvailability(debounced)
      .then(res => {
        if (cancelled) return;
        if (!res.ok || !res.data) {
          setStatus('error');
          return;
        }
        const { available, reason } = res.data as { available?: boolean; reason?: 'TAKEN' | 'BLOCKED_DOMAIN' };
        // Older backends omit `reason` — treat unavailable-without-reason as taken.
        setStatus(available ? 'available' : reason === 'BLOCKED_DOMAIN' ? 'blocked' : 'taken');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [debounced]);

  return status;
}

/**
 * Debounced check of subdomain availability. Returns status plus suggested
 * alternatives when taken, and the backend message when registration is blocked
 * on cluster capacity (409 `TENANT_REGISTRATION_BLOCKED`) so the caller can show
 * it inline instead of swallowing the 409 as a silent `'error'`.
 */
export function useDomainAvailability(
  subdomain: string,
  orgName: string,
  enabled: boolean,
  delay = 400,
): { status: AvailabilityStatus; suggestions: string[]; blockedMessage?: string } {
  const debounced = useDebounce(subdomain.trim(), delay);
  // Debounced too — otherwise every keystroke in Organization Name re-fires the check.
  const debouncedOrgName = useDebounce(orgName.trim(), delay);
  const [status, setStatus] = useState<AvailabilityStatus>('idle');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [blockedMessage, setBlockedMessage] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!enabled || !debounced) {
      setStatus('idle');
      setSuggestions([]);
      setBlockedMessage(undefined);
      return;
    }

    let cancelled = false;
    setStatus('checking');
    setSuggestions([]);
    setBlockedMessage(undefined);

    authApiClient
      .checkDomainAvailability(debounced, debouncedOrgName)
      .then(res => {
        if (cancelled) return;
        // No cluster capacity for new tenants — report it honestly so the user
        // learns registration is closed before pressing Create Account.
        const capacity = isTenantRegistrationBlocked(res);
        if (capacity.blocked) {
          setStatus('registration-blocked');
          setBlockedMessage(capacity.message || REGISTRATION_BLOCKED_MESSAGE);
          return;
        }
        if (!res.ok || !res.data) {
          setStatus('error');
          return;
        }
        const { available, suggestedUrl } = res.data as { available: boolean; suggestedUrl?: string[] };
        if (available) {
          setStatus('available');
          setSuggestions([]);
        } else {
          setStatus('taken');
          setSuggestions((suggestedUrl ?? []).map(url => url.replace(`.${SAAS_DOMAIN_SUFFIX}`, '')));
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [debounced, debouncedOrgName, enabled]);

  return { status, suggestions, blockedMessage };
}
