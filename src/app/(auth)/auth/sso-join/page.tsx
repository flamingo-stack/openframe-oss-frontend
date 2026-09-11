'use client';

import { SsoJoinForm } from '@flamingo-stack/openframe-frontend-core/components/features';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { AuthFormSkeleton } from '@/app/(auth)/auth/components/auth-page-skeleton';
import { SsoJoinCardLayout } from '@/app/(auth)/auth/components/sso-join-card-layout';
import { authApiClient, type PendingSsoJoin } from '@/lib/auth-api-client';
import { PRIVACY_POLICY_URL, TERMS_URL } from '@/lib/legal-urls';
import { MOBILE_AUTH_ERROR, readMobileAuthReturn } from '@/lib/mobile-auth-return';
import { routes } from '@/lib/routes';

/**
 * "One Last Step": the consent gate the auth server shows before an SSO flow CREATES a user - a new
 * member accepting an invitation, or a first login through a shared domain. The server redirects
 * here (`openframe.sso.join-confirm-url`) with nothing about the identity in the URL: it and the
 * destination live in the SAS session plus the flow cookie its callback kept, and this page only
 * reads them back.
 * An existing member, or a returning user, never lands here - the server lets them straight through.
 *
 * Two things carry over from `sso-continue`, and are easy to get wrong:
 *  1. `pendingSsoJoin()` is a session-cookie XHR. A 409 means the session or the flow cookie expired
 *     (they live ten minutes); there is nothing to recover, so the message is shown and the user goes
 *     back to login.
 *  2. Create Account is a TOP-LEVEL navigation, not a fetch. The response is a 302 chain into
 *     `/oauth/continue` that sets the auth cookies; a fetch would follow those redirects without ever
 *     committing them, and the user would land back here signed out.
 *
 * Back to Login is a plain navigation: nothing was created, and the flow cookie simply expires.
 *
 * On a native login this page renders inside the shell's browser sheet, which closes only on a
 * navigation to the app's custom scheme. Create Account gets there through `/oauth/continue`; the
 * two ways OUT (Back to Login, an expired session) would otherwise strand the person on the web
 * login inside the sheet. For a mobile flow the server appends `authMobile=true` and the app's
 * `redirectTo` to this page's URL, and both exits hand that address to the BFF's `/oauth/join-return`
 * with a reason; the BFF checks it against its allow-list and 302s into the app. The page never
 * navigates to the address itself.
 */
export default function SsoJoinPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const mobileReturn = readMobileAuthReturn(searchParams);

  const [pending, setPending] = useState<PendingSsoJoin | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Submit navigates away; without this the form re-enables under the departing page.
  const [isNavigating, setIsNavigating] = useState(false);
  const hasNavigated = useRef(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      const res = await authApiClient.pendingSsoJoin();
      if (!active) return;

      if (res.ok && res.data?.email) {
        setPending(res.data);
        return;
      }

      // Mobile: hand the outcome back to the app through the BFF; the app shows its own message
      // once the sheet closes.
      if (mobileReturn) {
        window.location.replace(authApiClient.ssoJoinReturnUrl(mobileReturn, MOBILE_AUTH_ERROR.SESSION_EXPIRED));
        return;
      }

      // 409 is the documented expiry signal and carries copy worth showing; anything else (an
      // invitation revoked meanwhile, a network failure) gets a generic line rather than a raw status.
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
  }, [mobileReturn, router, toast]);

  const handleSubmit = () => {
    if (hasNavigated.current || !agreedToTerms) return;
    hasNavigated.current = true;
    setIsNavigating(true);
    // A TOP-LEVEL navigation, not a fetch: see the note above.
    window.location.href = authApiClient.completeSsoJoinUrl();
  };

  const handleBack = () => {
    if (hasNavigated.current) return;
    if (mobileReturn) {
      // Through the BFF into the app, which treats the code like its own dismissed-sheet cancel
      // (no toast). A TOP-LEVEL navigation, like the submit.
      hasNavigated.current = true;
      setIsNavigating(true);
      window.location.href = authApiClient.ssoJoinReturnUrl(mobileReturn, MOBILE_AUTH_ERROR.USER_CANCELED);
      return;
    }
    router.push(routes.auth.login);
  };

  if (!pending) {
    return (
      <SsoJoinCardLayout>
        <AuthFormSkeleton variant="sso-join" />
      </SsoJoinCardLayout>
    );
  }

  // Either name can be missing (Apple, or a provider that only asserts an address); the form falls
  // back to the email when both are.
  const name = [pending.firstName, pending.lastName].filter(Boolean).join(' ');

  return (
    <SsoJoinCardLayout>
      <SsoJoinForm
        name={name}
        email={pending.email}
        organizationName={pending.tenantName}
        roles={pending.roles ?? []}
        agreedToTerms={agreedToTerms}
        onAgreedToTermsChange={setAgreedToTerms}
        onSubmit={handleSubmit}
        onBack={handleBack}
        loading={isNavigating}
        termsUrl={TERMS_URL}
        privacyPolicyUrl={PRIVACY_POLICY_URL}
      />
    </SsoJoinCardLayout>
  );
}
