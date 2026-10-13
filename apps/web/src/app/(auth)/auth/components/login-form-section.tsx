'use client';

import {
  type AuthSsoProvider,
  LoginForm,
  type LoginFormTenantMethods,
} from '@flamingo-stack/openframe-frontend-core/components/features';
import { useEffect, useRef, useState } from 'react';
import { EMAIL_REGEX, INVALID_EMAIL_ERROR } from '@/app/(auth)/auth/constants/registration-validation';
import type { TenantDiscoveryResponse } from '@/app/(auth)/auth/hooks/use-auth';
import { useLoginOnlyMobileShell } from '@/app/hooks/use-login-only-mobile-shell';
import { PRIVACY_POLICY_URL, TERMS_URL } from '@/lib/legal-urls';

/** Result of a tenant discovery for one email. */
export interface LoginDiscoveryResult {
  found: boolean;
  tenantName?: string;
  /** The tenant's built-in OpenFrame login is on. */
  openframe: boolean;
  /** Providers the tenant configured with its own credentials. */
  customProviders: AuthSsoProvider[];
}

/** The providers a tenant can configure with its own credentials — the keys of discovery's `providers`. */
const CUSTOMIZABLE_PROVIDERS = ['google', 'microsoft'] as const;
/** The built-in login in `auth_providers`; 'openframe-sso' is its legacy id. */
const OPENFRAME_IDS = ['openframe', 'openframe-sso'];

export function toLoginDiscoveryResult(response: TenantDiscoveryResponse): LoginDiscoveryResult {
  return {
    found: response.has_existing_accounts,
    tenantName: response.tenant_name || undefined,
    // An authorization server older than `openframe_login` reports the built-in login in
    // `auth_providers` instead, and has no `providers` — no custom SSO it could tell apart.
    openframe:
      response.openframe_login ?? (response.auth_providers || ['openframe']).some(id => OPENFRAME_IDS.includes(id)),
    customProviders: CUSTOMIZABLE_PROVIDERS.filter(provider => response.providers?.[provider] === true),
  };
}

interface LoginSectionProps {
  /** Runs tenant discovery for a syntactically valid email; null = request failed. */
  onDiscover: (email: string) => Promise<LoginDiscoveryResult | null>;
  onSso: (provider: AuthSsoProvider) => void;
  /** The generic providers this build offers. They need no tenant: the server resolves it from the identity. */
  genericProviders: AuthSsoProvider[];
  isLoading?: boolean;
}

type DiscoveryStatus = 'idle' | 'checking' | 'found' | 'not-found' | 'error';

const DISCOVERY_DEBOUNCE_MS = 400;

const NO_ACCOUNT_INVITATION_NOTICE =
  "No OpenFrame account is linked to this email. Accounts are created by your organization's administrator. Ask them for an invitation.";

/**
 * Wires the shared LoginForm to the login flow. Single screen, email first: the generic providers
 * under the field need nothing typed, and the email runs real-time (debounced, or at once on Enter)
 * tenant discovery. Once it resolves a tenant, that tenant's methods replace the generic block —
 * only its own when it configured any (the generic button of the same provider would sign in
 * through the platform's credentials, which such a tenant rejects), its OpenFrame login plus the
 * generic ones when it did not.
 */
export function LoginSection({ onDiscover, onSso, genericProviders, isLoading }: LoginSectionProps) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<DiscoveryStatus>('idle');
  const [result, setResult] = useState<LoginDiscoveryResult | null>(null);

  // The address discovery runs for: the field's value after a typing pause, or at once on Enter.
  const [lookupEmail, setLookupEmail] = useState('');
  useEffect(() => {
    const trimmed = email.trim();
    const timer = setTimeout(() => setLookupEmail(trimmed), DISCOVERY_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [email]);

  const isEmailValid = EMAIL_REGEX.test(email.trim());
  // Discovery results only apply while the field still holds the email they were made for.
  const isResultCurrent = email.trim() === lookupEmail;

  // The parent recreates onDiscover every render; a ref keeps the effect keyed
  // to the looked-up email only, without re-running discovery per render.
  const onDiscoverRef = useRef(onDiscover);
  // Latest-value refs, written after the commit rather than during render:
  // a render-phase ref write is what `react-hooks/refs` forbids, and every
  // reader below runs in an effect, a timer or an event handler.
  useEffect(() => {
    onDiscoverRef.current = onDiscover;
  });

  // The verdict for the CURRENT input is decided during render; the effect below
  // only performs the lookup. An effect would leave the previous email's methods
  // on screen for a frame after the field changes.
  const checkable = EMAIL_REGEX.test(lookupEmail);
  const [lastLookup, setLastLookup] = useState(lookupEmail);
  if (lookupEmail !== lastLookup) {
    setLastLookup(lookupEmail);
    setStatus(checkable ? 'checking' : 'idle');
    setResult(null);
  }

  useEffect(() => {
    if (!EMAIL_REGEX.test(lookupEmail)) {
      return undefined;
    }

    let cancelled = false;

    onDiscoverRef.current(lookupEmail).then(discovered => {
      if (cancelled) return;
      if (!discovered) {
        setStatus('error');
      } else if (discovered.found) {
        setStatus('found');
        setResult(discovered);
      } else {
        setStatus('not-found');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [lookupEmail]);

  const loginOnly = useLoginOnlyMobileShell();

  const showStatus = isEmailValid && isResultCurrent;
  // A login-only mobile build cannot send anyone to sign up, so an unknown address is told how an
  // account comes to exist there instead. It takes the notice row under the field: the field's own
  // message line is a single truncated line, and cut this down to "Accounts are…" on a phone.
  const showInvitationNotice = loginOnly && showStatus && status === 'not-found';
  const emailStatus =
    !showStatus || showInvitationNotice
      ? undefined
      : status === 'checking'
        ? { message: 'Checking your account…', variant: 'muted' as const }
        : status === 'not-found'
          ? { message: 'No account found for this email. Please sign up first.', variant: 'error' as const }
          : status === 'error'
            ? { message: 'Failed to check your account. Please try again.', variant: 'error' as const }
            : undefined;

  const tenant = showStatus && status === 'found' ? result : null;
  const tenantMethods: LoginFormTenantMethods | undefined = tenant
    ? {
        name: tenant.tenantName,
        providers: [...(tenant.openframe ? (['openframe'] as const) : []), ...tenant.customProviders],
      }
    : undefined;
  const ssoProviders = tenant && tenant.customProviders.length > 0 ? [] : genericProviders;

  // A typed address the lookup has not answered yet may belong to a tenant with its own SSO, and a
  // generic button clicked in that window takes the platform's credentials there — the sign-in that
  // tenant rejects. Hold every provider until the answer is in.
  const lookupPending = isEmailValid && (!isResultCurrent || status === 'checking');

  return (
    <LoginForm
      email={email}
      onEmailChange={setEmail}
      onEmailEnter={() => setLookupEmail(email.trim())}
      loading={isLoading}
      ssoProviders={ssoProviders}
      onSsoClick={onSso}
      ssoDisabled={lookupPending}
      tenantMethods={tenantMethods}
      notice={showInvitationNotice ? NO_ACCOUNT_INVITATION_NOTICE : undefined}
      emailStatus={emailStatus}
      errors={{
        email: email.trim() && !isEmailValid ? INVALID_EMAIL_ERROR : undefined,
      }}
      termsUrl={TERMS_URL}
      privacyPolicyUrl={PRIVACY_POLICY_URL}
    />
  );
}
