'use client';

import { type AuthSsoProvider, LoginForm } from '@flamingo-stack/openframe-frontend-core/components/features';
import { useDebounce } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useEffect, useRef, useState } from 'react';

/** Result of a tenant discovery for one email, mapped to form provider ids. */
export interface LoginDiscoveryResult {
  found: boolean;
  providers: AuthSsoProvider[];
}

interface LoginSectionProps {
  /** Runs tenant discovery for a syntactically valid email; null = request failed. */
  onDiscover: (email: string) => Promise<LoginDiscoveryResult | null>;
  onSso: (provider: AuthSsoProvider) => void;
  /** All providers to render (buttons stay visible but disabled until discovery unlocks them). */
  allProviders: AuthSsoProvider[];
  isLoading?: boolean;
}

type DiscoveryStatus = 'idle' | 'checking' | 'found' | 'not-found' | 'error';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DISCOVERY_DEBOUNCE_MS = 400;

/**
 * Wires the shared LoginForm to the login flow. Single-screen design: the
 * email field runs real-time (debounced) tenant discovery, and the SSO
 * provider buttons unlock once the email resolves to an existing account.
 */
export function LoginSection({ onDiscover, onSso, allProviders, isLoading }: LoginSectionProps) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<DiscoveryStatus>('idle');
  const [enabledProviders, setEnabledProviders] = useState<AuthSsoProvider[]>([]);

  const debouncedEmail = useDebounce(email, DISCOVERY_DEBOUNCE_MS);
  const isEmailValid = EMAIL_REGEX.test(email.trim());
  // Discovery results only apply while the field still holds the email they were made for.
  const isResultCurrent = email.trim() === debouncedEmail.trim();

  // The parent recreates onDiscover every render; a ref keeps the effect keyed
  // to the debounced email only, without re-running discovery per render.
  const onDiscoverRef = useRef(onDiscover);
  onDiscoverRef.current = onDiscover;

  useEffect(() => {
    const trimmed = debouncedEmail.trim();
    if (!EMAIL_REGEX.test(trimmed)) {
      setStatus('idle');
      setEnabledProviders([]);
      return;
    }

    let cancelled = false;
    setStatus('checking');
    setEnabledProviders([]);

    onDiscoverRef.current(trimmed).then(result => {
      if (cancelled) return;
      if (!result) {
        setStatus('error');
      } else if (result.found) {
        setStatus('found');
        setEnabledProviders(result.providers);
      } else {
        setStatus('not-found');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [debouncedEmail]);

  const showStatus = isEmailValid && isResultCurrent;
  const emailStatus = !showStatus
    ? undefined
    : status === 'checking'
      ? { message: 'Checking your account…', variant: 'muted' as const }
      : status === 'not-found'
        ? { message: 'No account found for this email. Please sign up first.', variant: 'error' as const }
        : status === 'error'
          ? { message: 'Failed to check your account. Please try again.', variant: 'error' as const }
          : undefined;

  const unlocked = showStatus && status === 'found';

  return (
    <LoginForm
      email={email}
      onEmailChange={setEmail}
      loading={isLoading}
      ssoProviders={allProviders}
      onSsoClick={onSso}
      ssoDisabled={!unlocked}
      ssoEnabledProviders={unlocked ? enabledProviders : []}
      emailStatus={emailStatus}
      errors={{
        email: email.trim() && !isEmailValid ? 'Enter a valid email address' : undefined,
      }}
    />
  );
}
