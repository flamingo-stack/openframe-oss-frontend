'use client';

import { type AuthSsoProvider, LoginForm } from '@flamingo-stack/openframe-frontend-core/components/features';
import { useDebounce } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useEffect, useRef, useState } from 'react';
import { EMAIL_REGEX, INVALID_EMAIL_ERROR } from '@/app/(auth)/auth/constants/registration-validation';

/** Result of a tenant discovery for one email, mapped to form provider ids. */
export interface LoginDiscoveryResult {
  found: boolean;
  providers: AuthSsoProvider[];
}

interface LoginSectionProps {
  /** Runs tenant discovery for a syntactically valid email; null = request failed. */
  onDiscover: (email: string) => Promise<LoginDiscoveryResult | null>;
  onSso: (provider: AuthSsoProvider) => void;
  /**
   * Every provider the build offers. The generic ones render above the email field and are never
   * gated; `openframe` is held back and reappears underneath it as a "Continue with OpenFrame"
   * button once discovery resolves a tenant that offers it.
   */
  allProviders: AuthSsoProvider[];
  isLoading?: boolean;
}

type DiscoveryStatus = 'idle' | 'checking' | 'found' | 'not-found' | 'error';

const DISCOVERY_DEBOUNCE_MS = 400;

/**
 * Wires the shared LoginForm to the login flow. Single-screen design: the external provider
 * buttons come first and need nothing typed — the server resolves the tenant from the identity
 * they assert — and the email field below runs real-time (debounced) tenant discovery, which
 * decides only whether the OpenFrame email path is offered.
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
  // Latest-value refs, written after the commit rather than during render:
  // a render-phase ref write is what `react-hooks/refs` forbids, and every
  // reader below runs in an effect, a timer or an event handler.
  useEffect(() => {
    onDiscoverRef.current = onDiscover;
  });

  // The verdict for the CURRENT input is decided during render; the effect below
  // only performs the lookup. An effect would leave the previous email's provider
  // list on screen for a frame after the field changes.
  const trimmedEmail = debouncedEmail.trim();
  const checkable = EMAIL_REGEX.test(trimmedEmail);
  const [lastEmail, setLastEmail] = useState(debouncedEmail);
  if (debouncedEmail !== lastEmail) {
    setLastEmail(debouncedEmail);
    setStatus(checkable ? 'checking' : 'idle');
    setEnabledProviders([]);
  }

  useEffect(() => {
    const trimmed = debouncedEmail.trim();
    if (!EMAIL_REGEX.test(trimmed)) {
      return undefined;
    }

    let cancelled = false;

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

  // The generic providers sit above the email, where they need nothing typed.
  const externalProviders: AuthSsoProvider[] = allProviders.filter(provider => provider !== 'openframe');
  // Everything the discovered tenant offers that is NOT already a button above — in practice its
  // OpenFrame SSO. These only exist once the tenant is known, so they appear under the email field
  // after discovery resolves. `undefined` until then: an empty array is a real answer ("this
  // domain has none") that the form renders as a notice, and it must not be shown before asking.
  const customSsoProviders = unlocked
    ? enabledProviders.filter(provider => !externalProviders.includes(provider))
    : undefined;

  return (
    <LoginForm
      email={email}
      onEmailChange={setEmail}
      loading={isLoading}
      ssoProviders={externalProviders}
      onSsoClick={onSso}
      // Never gated, before or after discovery — the design keeps these three constant. With no
      // tenant resolved they run the shared onboarding flow, which derives the tenant from the
      // identity the provider asserts; once one IS resolved the same click uses that tenant's own
      // SSO configuration. A tenant that has not configured the provider it names is the one gap
      // this leaves, and it surfaces at the gateway rather than as a locked button.
      ssoDisabled={false}
      customSsoProviders={customSsoProviders}
      dividerLabel="or enter email to continue with custom SSO"
      emailStatus={emailStatus}
      errors={{
        email: email.trim() && !isEmailValid ? INVALID_EMAIL_ERROR : undefined,
      }}
    />
  );
}
