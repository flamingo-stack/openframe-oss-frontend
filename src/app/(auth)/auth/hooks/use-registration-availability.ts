'use client';

import { useDebounce } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useEffect, useState } from 'react';
import { authApiClient, SAAS_DOMAIN_SUFFIX } from '@/lib/auth-api-client';

export type AvailabilityStatus = 'idle' | 'checking' | 'available' | 'taken' | 'blocked' | 'error';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const BLOCKED_EMAIL_DOMAIN_MESSAGE =
  'Disposable and privacy-focused email providers are not allowed. Please use your work or personal email.';

/** Debounced check of whether an email is already registered. Runs only on valid email format. */
export function useEmailAvailability(email: string, delay = 400): AvailabilityStatus {
  const debounced = useDebounce(email.trim(), delay);
  const [status, setStatus] = useState<AvailabilityStatus>('idle');

  // Nothing to check → idle, decided during render: an effect would leave the
  // previous verdict (a red "taken") on screen for a frame after the field is
  // cleared.
  const [lastDebounced, setLastDebounced] = useState(debounced);
  const checkable = Boolean(debounced) && EMAIL_REGEX.test(debounced);
  if (debounced !== lastDebounced) {
    setLastDebounced(debounced);
    setStatus(checkable ? 'checking' : 'idle');
  }

  useEffect(() => {
    if (!checkable) return undefined;

    let cancelled = false;

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
  }, [debounced, checkable]);

  return status;
}

/** Debounced check of subdomain availability; returns status plus suggested alternatives when taken. */
export function useDomainAvailability(
  subdomain: string,
  orgName: string,
  enabled: boolean,
  delay = 400,
): { status: AvailabilityStatus; suggestions: string[] } {
  const debounced = useDebounce(subdomain.trim(), delay);
  // Debounced too — otherwise every keystroke in Organization Name re-fires the check.
  const debouncedOrgName = useDebounce(orgName.trim(), delay);
  const [status, setStatus] = useState<AvailabilityStatus>('idle');
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // The verdict for the CURRENT input is decided during render — an effect would
  // leave the previous domain's "taken" badge (and its suggestions) on screen for
  // a frame after the field changes. The effect below only performs the request.
  const checkable = enabled && Boolean(debounced);
  const [lastInputs, setLastInputs] = useState({ debounced, debouncedOrgName, enabled });
  if (
    debounced !== lastInputs.debounced ||
    debouncedOrgName !== lastInputs.debouncedOrgName ||
    enabled !== lastInputs.enabled
  ) {
    setLastInputs({ debounced, debouncedOrgName, enabled });
    setStatus(checkable ? 'checking' : 'idle');
    setSuggestions([]);
  }

  useEffect(() => {
    if (!checkable) return undefined;

    let cancelled = false;

    authApiClient
      .checkDomainAvailability(debounced, debouncedOrgName)
      .then(res => {
        if (cancelled) return;
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
  }, [debounced, debouncedOrgName, checkable]);

  return { status, suggestions };
}
