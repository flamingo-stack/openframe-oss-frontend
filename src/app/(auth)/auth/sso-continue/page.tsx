'use client';

import {
  AuthShell,
  type AuthSsoProvider,
  PROVIDER_META,
} from '@flamingo-stack/openframe-frontend-core/components/features';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SsoOrganizationSetup } from '@/app/(auth)/auth/components/sso-organization-setup';
import { authApiClient, type PendingSsoIdentity } from '@/lib/auth-api-client';
import { completeNativeSsoSignup } from '@/lib/native-login';
import { markPendingSignup } from '@/lib/posthog/posthog-events';
import { routes } from '@/lib/routes';

/** The authorization server's id for the built-in provider; the design system calls it `openframe`. */
const OPENFRAME_SSO_ID = 'openframe-sso';

function providerLabel(provider: string): string {
  const key = (provider === OPENFRAME_SSO_ID ? 'openframe' : provider) as AuthSsoProvider;
  return PROVIDER_META[key]?.name ?? provider;
}

/**
 * Continues an SSO login whose identity has no OpenFrame account yet.
 *
 * The auth server redirects here (`openframe.sso.login.signup-continue-url`) after a provider has
 * authenticated someone it cannot route to a tenant. The identity is already established and lives
 * in the SAS session — this page never asks for it again, and never lets it be edited, because the
 * server reads the address from the session and would ignore anything typed here.
 *
 * Two things are easy to get wrong here:
 *  1. `pendingSsoIdentity()` is a session-cookie XHR. A 409 means the session or the flow cookie
 *     expired; there is nothing to recover, so the message is shown and the user goes back to login.
 *  2. Submit is a TOP-LEVEL navigation, not a fetch. The response is a 302 chain into
 *     `/oauth/continue` that sets the auth cookies; a fetch would follow those redirects without
 *     ever committing them, and the user would land back here signed out.
 */
export default function SsoContinuePage() {
  const router = useRouter();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const signupTicket = searchParams.get('signupTicket');

  const [identity, setIdentity] = useState<PendingSsoIdentity | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'expired'>('loading');

  // Submit navigates away; without this the form re-enables under the departing page.
  const [isNavigating, setIsNavigating] = useState(false);
  const hasNavigated = useRef(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      // Ticket in the URL means the shell brought us here after a browser-flow signup: the identity
      // is named by the ticket, not by a session cookie the app's WebView never received.
      const res = signupTicket
        ? await authApiClient.pendingSsoIdentityByTicket(signupTicket)
        : await authApiClient.pendingSsoIdentity();
      if (!active) return;

      if (res.ok && res.data?.email) {
        setIdentity(res.data);
        setLoadState('ready');
        return;
      }

      // 409 is the documented expiry signal and carries copy worth showing; anything else gets a
      // generic line rather than a raw status.
      setLoadState('expired');
      toast({
        title: 'Sign-in session expired',
        description:
          res.status === 409 && res.error ? res.error : 'Your sign-in session has expired. Please sign in again.',
        variant: 'destructive',
      });
      router.replace(routes.auth.login);
    })();
    return () => {
      active = false;
    };
  }, [router, toast, signupTicket]);

  const handleSubmit = useCallback(
    async (values: { tenantName: string; tenantDomain: string }) => {
      if (hasNavigated.current) return;
      hasNavigated.current = true;
      setIsNavigating(true);
      // Marked before either path leaves: `signup_completed` is deferred to the first identified
      // session and gated on this, so every signup path has to set it or the funnel loses its
      // SSO half.
      markPendingSignup();

      if (!signupTicket) {
        // Browser flow. A TOP-LEVEL navigation, not a fetch: the response is a 302 chain into
        // `/oauth/continue` that sets the auth cookies, and a fetch would follow those redirects
        // without ever committing them, landing the user back here signed out.
        window.location.href = authApiClient.completeSsoRegistrationUrl(values);
        return;
      }

      // Native flow. No cookies to commit — the server answers with a devTicket, and the shell
      // exchanges it the same way it does for a login.
      try {
        await completeNativeSsoSignup({ ticket: signupTicket, ...values });
        window.location.replace(routes.dashboard);
      } catch (error) {
        hasNavigated.current = false;
        setIsNavigating(false);
        toast({
          title: "Couldn't create your organization",
          description: error instanceof Error && error.message ? error.message : 'Please try again.',
          variant: 'destructive',
        });
      }
    },
    [signupTicket, toast],
  );

  if (loadState !== 'ready' || !identity) {
    return (
      <AuthShell>
        <div className="min-h-[320px]" aria-busy="true" aria-live="polite" />
      </AuthShell>
    );
  }

  const label = providerLabel(identity.provider);

  return (
    <AuthShell>
      <SsoOrganizationSetup
        subtitle={`Continuing as ${identity.email} via ${label}.`}
        email={identity.email}
        emailReadOnlyLabel={`Signed in with ${label}`}
        onSubmit={handleSubmit}
        isSubmitting={isNavigating}
      />
    </AuthShell>
  );
}
