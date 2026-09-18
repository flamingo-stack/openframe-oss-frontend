'use client';

import { type AuthSsoProvider, LoginForm } from '@flamingo-stack/openframe-frontend-core/components/features';
import { useDebounce } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useCallback, useEffect, useRef, useState } from 'react';
import { EMAIL_REGEX, INVALID_EMAIL_ERROR } from '@/app/(auth)/auth/constants/registration-validation';
import { useLoginOnlyMobileShell } from '@/app/hooks/use-login-only-mobile-shell';
import { PRIVACY_POLICY_URL, TERMS_URL } from '@/lib/legal-urls';
import { pushLoginContinueClicked } from '@/lib/posthog/posthog-events';

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

// A login-only mobile build cannot send anyone to sign up, so it tells the user how an account
// comes to exist there instead.
const NO_ACCOUNT_INVITATION_NOTICE =
  "No OpenFrame account is linked to this email. Accounts are created by your organization's administrator. Ask them for an invitation.";

// The web build has a Sign Up tab, so it points there.
const NO_ACCOUNT_SIGNUP_NOTICE =
  'No OpenFrame account uses this email. Open the Sign Up tab to create one, or check the address and try again.';

const DISCOVERY_ERROR_NOTICE =
  'We could not check this email. Check your connection, then select Continue to try again.';

/**
 * Wires the shared LoginForm to the login flow. Single-screen design: the external provider
 * buttons come first and need nothing typed — the server resolves the tenant from the identity
 * they assert — and the email field below runs tenant discovery, which decides only whether the
 * OpenFrame email path is offered.
 *
 * The email field has an explicit Continue button. It runs discovery at once instead of waiting on
 * the debounce, so the field has a submit control like the Sign Up tab beside it. Discovery also
 * still runs on a debounce as the user types, which reveals the OpenFrame button for a returning
 * user without a click.
 */
export function LoginSection({ onDiscover, onSso, allProviders, isLoading }: LoginSectionProps) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<DiscoveryStatus>('idle');
  const [enabledProviders, setEnabledProviders] = useState<AuthSsoProvider[]>([]);
  // The email the current status and results describe. While the field holds a different value the
  // result is stale and stays hidden, so no previous provider list lingers for a frame.
  const [checkedEmail, setCheckedEmail] = useState('');

  const debouncedEmail = useDebounce(email, DISCOVERY_DEBOUNCE_MS);
  const isEmailValid = EMAIL_REGEX.test(email.trim());
  const isResultCurrent = email.trim() === checkedEmail;

  // The parent recreates onDiscover every render; a ref keeps discovery keyed to the email only.
  // Written after the commit rather than during render, which `react-hooks/refs` forbids.
  const onDiscoverRef = useRef(onDiscover);
  useEffect(() => {
    onDiscoverRef.current = onDiscover;
  });

  // Names the newest lookup so a slow earlier promise cannot overwrite a newer result. Written only
  // from the effect and the handler below, never during render.
  const latestLookupRef = useRef('');

  // Applies a resolved lookup, unless a newer one has since started. Called from the promise
  // callbacks, so the setState calls are async and do not run synchronously inside an effect.
  const applyResult = useCallback((trimmed: string, result: LoginDiscoveryResult | null) => {
    if (latestLookupRef.current !== trimmed) return;
    if (!result) {
      setStatus('error');
    } else if (result.found) {
      setStatus('found');
      setEnabledProviders(result.providers);
    } else {
      setStatus('not-found');
    }
  }, []);

  // The passive path's "checking" transition happens here in render, not in the effect below,
  // because synchronous setState inside an effect is disallowed. Setting checkedEmail makes the
  // status visible for the newly settled email; the effect then performs the lookup.
  const trimmedDebounced = debouncedEmail.trim();
  const [lastDebounced, setLastDebounced] = useState(debouncedEmail);
  if (debouncedEmail !== lastDebounced) {
    setLastDebounced(debouncedEmail);
    if (EMAIL_REGEX.test(trimmedDebounced)) {
      setCheckedEmail(trimmedDebounced);
      setStatus('checking');
      setEnabledProviders([]);
    }
  }

  // Passive path: discover as the user pauses typing.
  useEffect(() => {
    const trimmed = debouncedEmail.trim();
    if (!EMAIL_REGEX.test(trimmed)) return;
    latestLookupRef.current = trimmed;
    onDiscoverRef.current(trimmed).then(result => applyResult(trimmed, result));
  }, [debouncedEmail, applyResult]);

  // Explicit path: the Continue button discovers the current email at once, ahead of the debounce.
  const handleContinue = () => {
    pushLoginContinueClicked();
    const trimmed = email.trim();
    if (!EMAIL_REGEX.test(trimmed)) return;
    latestLookupRef.current = trimmed;
    setCheckedEmail(trimmed);
    setStatus('checking');
    setEnabledProviders([]);
    onDiscoverRef.current(trimmed).then(result => applyResult(trimmed, result));
  };

  const loginOnly = useLoginOnlyMobileShell();

  const showStatus = isEmailValid && isResultCurrent;
  const isChecking = showStatus && status === 'checking';
  const unlocked = showStatus && status === 'found';
  // A resolved lookup with no forward path of its own — no account, or a failed check. It takes a
  // full notice block with a plain next step, not a single truncated error line.
  const showNotice = showStatus && (status === 'not-found' || status === 'error');
  const noticeLabel = showNotice
    ? status === 'error'
      ? DISCOVERY_ERROR_NOTICE
      : loginOnly
        ? NO_ACCOUNT_INVITATION_NOTICE
        : NO_ACCOUNT_SIGNUP_NOTICE
    : undefined;

  const emailStatus = isChecking ? { message: 'Checking your account…', variant: 'muted' as const } : undefined;

  // The generic providers sit above the email, where they need nothing typed.
  const externalProviders: AuthSsoProvider[] = allProviders.filter(provider => provider !== 'openframe');
  // Everything the discovered tenant offers that is NOT already a button above — in practice its
  // OpenFrame SSO. These only exist once the tenant is known, so they appear under the email field
  // after discovery resolves. `undefined` until then: an empty array is a real answer that the form
  // renders as a notice, and it must not be shown before asking.
  const customSsoProviders = unlocked
    ? enabledProviders.filter(provider => !externalProviders.includes(provider))
    : showNotice
      ? []
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
      noCustomSsoLabel={noticeLabel}
      dividerLabel="or enter email to continue with custom SSO"
      emailStatus={emailStatus}
      // Hidden once a tenant is found: the "Continue with OpenFrame" button above is the action then.
      onSubmitClick={unlocked ? undefined : handleContinue}
      submitLabel={isChecking ? 'Checking…' : 'Continue'}
      submitDisabled={!isEmailValid || isChecking}
      errors={{
        email: email.trim() && !isEmailValid ? INVALID_EMAIL_ERROR : undefined,
      }}
      termsUrl={TERMS_URL}
      privacyPolicyUrl={PRIVACY_POLICY_URL}
    />
  );
}
