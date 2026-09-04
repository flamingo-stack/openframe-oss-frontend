'use client';

import { AuthShell } from '@flamingo-stack/openframe-frontend-core/components/features';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ssoProviderLabel } from '@/app/(auth)/auth/components/native-sso-signup-section';
import { SsoOrganizationSetup } from '@/app/(auth)/auth/components/sso-organization-setup';
import { authApiClient, type PendingSsoIdentity } from '@/lib/auth-api-client';
import { markPendingSignup } from '@/lib/posthog/posthog-events';
import { routes } from '@/lib/routes';

/**
 * Continues a browser-flow SSO login whose identity has no OpenFrame account yet. The native shells
 * never come here: their signup renders in-tab from a ticket (see NativeSsoSignupSection).
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

  const [identity, setIdentity] = useState<PendingSsoIdentity | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'expired'>('loading');

  // Submit navigates away; without this the form re-enables under the departing page.
  const [isNavigating, setIsNavigating] = useState(false);
  const hasNavigated = useRef(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      const res = await authApiClient.pendingSsoIdentity();
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
  }, [router, toast]);

  const handleSubmit = useCallback((values: { tenantName: string; tenantDomain: string }) => {
    if (hasNavigated.current) return;
    hasNavigated.current = true;
    setIsNavigating(true);
    // Before the navigation, not after: this leaves the page, and `signup_completed` is deferred to
    // the first identified session and gated on this marker. Every signup path has to set it or the
    // funnel simply loses its SSO half.
    markPendingSignup();
    // A TOP-LEVEL navigation, not a fetch: the response is a 302 chain into `/oauth/continue` that
    // sets the auth cookies, and a fetch would follow those redirects without ever committing them.
    window.location.href = authApiClient.completeSsoRegistrationUrl(values);
  }, []);

  if (loadState !== 'ready' || !identity) {
    return (
      <AuthShell>
        <div className="min-h-[320px]" aria-busy="true" aria-live="polite" />
      </AuthShell>
    );
  }

  const label = ssoProviderLabel(identity.provider);

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
