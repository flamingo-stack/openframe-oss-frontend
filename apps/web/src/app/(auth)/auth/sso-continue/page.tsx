'use client';

import { AuthShell } from '@flamingo-stack/openframe-frontend-core/components/features';
import { LoadingWhen } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SsoOrganizationSetup } from '@/app/(auth)/auth/components/sso-organization-setup';
import { saveSsoSetupDraft, type SsoSetupValues, takeSsoSetupDraft } from '@/app/(auth)/auth/utils/sso-setup-draft';
import { type AuthApiResponse, authApiClient, type PendingSsoIdentity } from '@/lib/auth-api-client';
import { captureSsoSetupRestored, markPendingSignup, pushIdentify } from '@/lib/posthog/posthog-events';
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
 * Three things are easy to get wrong here:
 *  1. `pendingSsoIdentity()` is a session-cookie XHR. A 409 means the session or the flow cookie
 *     expired; there is nothing to recover, so the message is shown and the user goes back to login.
 *  2. The session can expire while the form is open. Submit reads it again first, and saves the typed
 *     details (`sso-setup-draft.ts`), so a new sign-in brings the user back here with them filled in.
 *  3. Submit is a TOP-LEVEL navigation, not a fetch. The response is a 302 chain into
 *     `/oauth/continue` that sets the auth cookies; a fetch would follow those redirects without
 *     ever committing them, and the user would land back here signed out.
 */
export default function SsoContinuePage() {
  const router = useRouter();
  const { toast } = useToast();

  const [identity, setIdentity] = useState<PendingSsoIdentity | null>(null);
  const [draft, setDraft] = useState<SsoSetupValues | null>(null);

  // Submit navigates away; without this the form re-enables under the departing page.
  const [isNavigating, setIsNavigating] = useState(false);
  const hasNavigated = useRef(false);

  const leaveExpired = useCallback(
    (res: AuthApiResponse<PendingSsoIdentity>, detailsKept: boolean) => {
      // 409 is the documented expiry signal and carries copy worth showing; anything else gets a
      // generic line rather than a raw status.
      const reason = res.status === 409 && res.error ? res.error : null;
      toast({
        title: 'Sign-in session expired',
        description: detailsKept
          ? `${reason ?? 'Your sign-in session has expired.'} Sign in again to continue. Your organization details are kept.`
          : (reason ?? 'Your sign-in session has expired. Please sign in again.'),
        variant: 'destructive',
      });
      router.replace(routes.auth.login);
    },
    [router, toast],
  );

  useEffect(() => {
    let active = true;
    void (async () => {
      const res = await authApiClient.pendingSsoIdentity();
      if (!active) return;

      if (res.ok && res.data?.email) {
        // GTM's identify on /auth reads a typed address on a button click; Enter submits without one.
        // This is the address the tenant identifies the person by.
        pushIdentify({ email: res.data.email });
        const restored = takeSsoSetupDraft(res.data.email);
        if (restored) captureSsoSetupRestored();
        setDraft(restored);
        setIdentity(res.data);
        return;
      }

      leaveExpired(res, false);
    })();
    return () => {
      active = false;
    };
  }, [leaveExpired]);

  const handleSubmit = useCallback(
    async (values: SsoSetupValues) => {
      if (hasNavigated.current || !identity?.email) return;
      hasNavigated.current = true;
      setIsNavigating(true);
      // Saved before the check and kept after it: the server can still answer the navigation with its
      // own expiry page, and the details then come back after the new sign-in all the same.
      saveSsoSetupDraft(identity.email, values);
      // The session was read when the page opened; it can have expired while the form was filled in.
      const res = await authApiClient.pendingSsoIdentity();
      if (res.status === 0) {
        // No answer is not an expiry: the form stays up for another try.
        hasNavigated.current = false;
        setIsNavigating(false);
        throw new Error("Couldn't reach the sign-in server. Please try again.");
      }
      if (!res.ok || !res.data?.email) {
        leaveExpired(res, true);
        return;
      }
      // Before the navigation, not after: this leaves the page, and `signup_completed` is deferred to
      // the first identified session and gated on this marker. Every signup path has to set it or the
      // funnel simply loses its SSO half.
      markPendingSignup();
      // A TOP-LEVEL navigation, not a fetch: the response is a 302 chain into `/oauth/continue` that
      // sets the auth cookies, and a fetch would follow those redirects without ever committing them.
      window.location.href = authApiClient.completeSsoRegistrationUrl(values);
    },
    [identity, leaveExpired],
  );

  return (
    // One form, loaded or not: while the identity is read it draws its own loading state.
    <AuthShell>
      <LoadingWhen loading={!identity}>
        <SsoOrganizationSetup
          // A restored draft arrives with the identity, after the form mounted: remount to take it.
          key={draft ? 'restored' : 'new'}
          identity={identity}
          onSubmit={handleSubmit}
          isSubmitting={isNavigating}
          initialValues={draft ?? undefined}
        />
      </LoadingWhen>
    </AuthShell>
  );
}
