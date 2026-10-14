'use client';

import {
  type AuthSsoProvider,
  LoginForm,
  type LoginFormTenantMethods,
} from '@flamingo-stack/openframe-frontend-core/components/features';
import { useEffect, useRef, useState } from 'react';
import { EMAIL_REGEX, INVALID_EMAIL_ERROR } from '@/app/(auth)/auth/constants/registration-validation';
import type { SsoLoginTenant, TenantDiscoveryResponse } from '@/app/(auth)/auth/hooks/use-auth';
import { useLoginOnlyMobileShell } from '@/app/hooks/use-login-only-mobile-shell';
import { PRIVACY_POLICY_URL, TERMS_URL } from '@/lib/legal-urls';

/** Result of a tenant discovery for one email. */
export interface LoginDiscoveryResult {
  found: boolean;
  /** The tenant the email resolved to; null when it resolved none. */
  tenant: SsoLoginTenant | null;
  tenantName?: string;
  /** The tenant's built-in OpenFrame login is on. */
  openframe: boolean;
  /** Providers the tenant configured with its own credentials. */
  customProviders: Exclude<AuthSsoProvider, 'openframe'>[];
}

/** The providers a tenant can configure with its own credentials — the keys of discovery's `providers`. */
const CUSTOMIZABLE_PROVIDERS = ['google', 'microsoft'] as const;
/** The built-in login in `auth_providers`; 'openframe-sso' is its legacy id. */
const OPENFRAME_IDS = ['openframe', 'openframe-sso'];

export function toLoginDiscoveryResult(response: TenantDiscoveryResponse): LoginDiscoveryResult {
  return {
    found: response.has_existing_accounts,
    tenant: response.tenant_id
      ? {
          tenantId: response.tenant_id,
          // 'localhost' is discovery's answer for a single-tenant dev backend, not a host.
          tenantDomain: response.domain && response.domain !== 'localhost' ? response.domain : undefined,
        }
      : null,
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
  /** `tenant` is the organization whose methods are on screen at the click; null while none is. */
  onSso: (provider: AuthSsoProvider, tenant: SsoLoginTenant | null) => void;
  /** The generic providers this build offers. They need no tenant: the server resolves it from the identity. */
  genericProviders: AuthSsoProvider[];
  isLoading?: boolean;
}

type DiscoveryStatus = 'idle' | 'checking' | 'found' | 'not-found' | 'error';

/**
 * One run of discovery. Each run is a new object, and that identity is what ties an answer to the
 * run that asked for it — so a retry of the same address is a new run too.
 */
interface Lookup {
  email: string;
}

/** What a run answered: the result, or null when the request failed. */
interface Answer {
  for: Lookup;
  result: LoginDiscoveryResult | null;
}

const DISCOVERY_DEBOUNCE_MS = 400;
const DISCOVERY_TIMEOUT_MS = 10_000;

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
  const trimmedEmail = email.trim();

  // The run on screen: the field's value after a typing pause, or at once on Enter.
  const [lookup, setLookup] = useState<Lookup>({ email: '' });
  const [answer, setAnswer] = useState<Answer | null>(null);
  useEffect(() => {
    const timer = setTimeout(
      () => setLookup(previous => (previous.email === trimmedEmail ? previous : { email: trimmedEmail })),
      DISCOVERY_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [trimmedEmail]);

  const isEmailValid = EMAIL_REGEX.test(trimmedEmail);
  // Discovery results only apply while the field still holds the email they were made for.
  const isResultCurrent = trimmedEmail === lookup.email;

  // The parent recreates onDiscover every render; a ref keeps the effect keyed
  // to the run only, without re-running discovery per render.
  const onDiscoverRef = useRef(onDiscover);
  // Latest-value refs, written after the commit rather than during render:
  // a render-phase ref write is what `react-hooks/refs` forbids, and every
  // reader below runs in an effect, a timer or an event handler.
  useEffect(() => {
    onDiscoverRef.current = onDiscover;
  });

  useEffect(() => {
    if (!EMAIL_REGEX.test(lookup.email)) {
      return undefined;
    }

    // `cancelled` stops a late answer from overwriting a newer run's; `for` keeps one that lands
    // before this cleanup has run from being read as the newer run's answer.
    let cancelled = false;
    const answerWith = (outcome: LoginDiscoveryResult | null) => {
      if (!cancelled) setAnswer({ for: lookup, result: outcome });
    };

    // A lookup that rejects or never settles would hold every provider for good, so either counts
    // as a failed one. An answer that arrives after the deadline still replaces the failure.
    const deadline = setTimeout(() => answerWith(null), DISCOVERY_TIMEOUT_MS);
    onDiscoverRef
      .current(lookup.email)
      .catch(error => {
        console.error('Tenant discovery failed:', error);
        return null;
      })
      .then(outcome => {
        clearTimeout(deadline);
        answerWith(outcome);
      });

    return () => {
      cancelled = true;
      clearTimeout(deadline);
    };
  }, [lookup]);

  // Derived for the run on screen, so the previous address's verdict never shows for a frame.
  const result = answer?.for === lookup ? answer.result : undefined;
  const status: DiscoveryStatus = !EMAIL_REGEX.test(lookup.email)
    ? 'idle'
    : result === undefined
      ? 'checking'
      : result === null
        ? 'error'
        : result.found
          ? 'found'
          : 'not-found';

  // Enter looks the address up now, and tries again on the address whose lookup failed.
  const lookUpNow = () => {
    if (trimmedEmail !== lookup.email || status === 'error') setLookup({ email: trimmedEmail });
  };

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

  // The one source for both what the card shows and where a click goes: a tenant's methods are on
  // screen exactly when a click signs in to that tenant.
  const discovered = showStatus && result?.found && result.tenant ? result : null;
  const tenantMethods: LoginFormTenantMethods | undefined = discovered
    ? { name: discovered.tenantName, openframe: discovered.openframe, providers: discovered.customProviders }
    : undefined;
  const ssoProviders = discovered && discovered.customProviders.length > 0 ? [] : genericProviders;

  // A typed address the lookup has not answered yet may belong to a tenant with its own SSO, and a
  // generic button clicked in that window takes the platform's credentials there — the sign-in that
  // tenant rejects. Hold every provider until the answer is in. A failed lookup releases them:
  // discovery being down must not take sign-in down with it.
  const lookupPending = isEmailValid && (!isResultCurrent || status === 'checking');

  return (
    <LoginForm
      email={email}
      onEmailChange={setEmail}
      onEmailEnter={lookUpNow}
      loading={isLoading}
      ssoProviders={ssoProviders}
      onSsoClick={provider => onSso(provider, discovered?.tenant ?? null)}
      ssoDisabled={lookupPending}
      tenantMethods={tenantMethods}
      notice={showInvitationNotice ? NO_ACCOUNT_INVITATION_NOTICE : undefined}
      emailStatus={emailStatus}
      errors={{
        email: trimmedEmail && !isEmailValid ? INVALID_EMAIL_ERROR : undefined,
      }}
      termsUrl={TERMS_URL}
      privacyPolicyUrl={PRIVACY_POLICY_URL}
    />
  );
}
