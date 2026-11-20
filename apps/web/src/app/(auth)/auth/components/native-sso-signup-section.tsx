'use client';

import { Button, LoadingWhen } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useCallback, useEffect, useState } from 'react';
import { SsoOrganizationSetup, type SsoSetupIdentity } from '@/app/(auth)/auth/components/sso-organization-setup';
import { authApiClient } from '@/lib/auth-api-client';
import {
  appleIdentityEmail,
  appleNativeRegister,
  AppleRegisterError,
  completeNativeSsoSignup,
  type PendingSsoSignup,
  SsoSignupTicketError,
} from '@/lib/native-login';
import { markPendingSignup } from '@/lib/posthog/posthog-events';

interface NativeSsoSignupSectionProps {
  /** The verified identity, in whichever form the flow returned it. Memory-only. */
  pending: PendingSsoSignup;
  /** Runs after tokens are stored, to leave the auth screen. */
  onRegistered: () => void;
  /**
   * Discards the identity and returns to the sign-in form. Wired to the form's Back action: the
   * tab selector stays visible too, but a route change is not a reliable exit — from the login
   * page this section already renders AT `/auth/login`, so replacing that route is a no-op.
   */
  onExit: () => void;
}

/**
 * Organization form for a verified SSO identity that has no account yet — the one screen both
 * native signup paths share, so they look and behave the same.
 *
 * Rendered in place on whichever tab the provider was tapped from, never at its own route: the
 * identity cannot survive a navigation (Apple's authorization code is single-use, the ticket names
 * a live server-side session), and putting either in a URL would be worse than losing it.
 *
 * The email is shown read-only for both origins. Apple's comes off the identity token; for a
 * Hide My Email user that is the relay address, which is genuinely the address on the account and
 * the one the user would need to recognise later. Neither is editable — the gateway reads the
 * address from the verified identity and ignores anything typed here.
 */
export function NativeSsoSignupSection({ pending, onRegistered, onExit }: NativeSsoSignupSectionProps) {
  const { toast } = useToast();

  // Apple's identity is in hand; a ticket's has to be fetched first.
  const [identity, setIdentity] = useState<SsoSetupIdentity | null>(
    pending.kind === 'apple' ? { email: appleIdentityEmail(pending.credential), provider: 'apple' } : null,
  );
  // Set once a failed submit has consumed the credential: Apple's authorization code, or a ticket
  // the server may have redeemed. Neither is reissued, so this screen is finished either way and
  // must stop offering a retry it cannot honour. Kept separate from the message: an error carrying
  // none must still end the screen.
  const [isSpent, setIsSpent] = useState(false);
  const [spentMessage, setSpentMessage] = useState<string | null>(null);
  // The ticket was redeemed and the organization exists; only signing in to it failed.
  const [organizationCreated, setOrganizationCreated] = useState(false);
  // Covers the register call itself; the shared form's own busy flag covers only its availability
  // re-check. Without this the button re-enables mid-flight and a second tap would resubmit.
  const [isRegistering, setIsRegistering] = useState(false);

  useEffect(() => {
    if (pending.kind !== 'ticket') return undefined;
    let active = true;
    void (async () => {
      const res = await authApiClient.pendingSsoIdentityByTicket(pending.ticket);
      if (!active) return;
      if (res.ok && res.data?.email) {
        setIdentity({ email: res.data.email, provider: res.data.provider });
        return;
      }
      // 409 is the documented expiry signal; there is nothing to recover, so back to sign-in.
      toast({
        title: 'Sign-up session expired',
        description: 'Your sign-up session has expired. Please sign in again.',
        variant: 'destructive',
      });
      onExit();
    })();
    return () => {
      active = false;
    };
  }, [pending, toast, onExit]);

  const handleSubmit = useCallback(
    async (values: { tenantName: string; tenantDomain: string }) => {
      setIsRegistering(true);
      try {
        if (pending.kind === 'apple') {
          await appleNativeRegister({ credential: pending.credential, ...values });
        } else {
          await completeNativeSsoSignup({ ticket: pending.ticket, ...values });
        }
      } catch (error) {
        setIsRegistering(false);
        // A failure that did NOT consume the credential is correctable in place: rethrow so the form
        // surfaces it. One that did ends the screen. Apple's default is spent; a ticket's is not, so
        // an error before the request (no native plugin) keeps the form.
        const spent =
          pending.kind === 'apple'
            ? !(error instanceof AppleRegisterError && !error.credentialSpent)
            : error instanceof SsoSignupTicketError && error.ticketSpent;
        if (spent) {
          setIsSpent(true);
          setSpentMessage(error instanceof Error && error.message ? error.message : null);
          setOrganizationCreated(error instanceof SsoSignupTicketError && error.organizationCreated);
          return;
        }
        throw error;
      }
      // Server-confirmed registration — same marker the password path sets, so `signup_completed`
      // fires for a native SSO signup too.
      markPendingSignup();
      onRegistered();
    },
    [pending, onRegistered],
  );

  if (isSpent) {
    return (
      <div className="flex w-full flex-col gap-[var(--spacing-system-l)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-xl)]">
        <h1 className="tracking-[-0.64px] text-ods-text-primary text-h2">
          {organizationCreated ? 'Your organization is created' : "Couldn't create your organization"}
        </h1>
        <p className="text-ods-text-secondary text-h4">
          {spentMessage ? `${spentMessage} ` : ''}
          {pending.kind === 'apple'
            ? 'Sign in with Apple again to retry.'
            : organizationCreated
              ? 'Sign in again to open it.'
              : 'Sign in again to retry.'}
        </p>
        <Button variant="accent" fullWidth onClick={onExit}>
          Back to sign in
        </Button>
      </div>
    );
  }

  return (
    // One form, loaded or not: while the identity is read it draws its own loading state.
    <LoadingWhen loading={!identity}>
      <SsoOrganizationSetup identity={identity} onSubmit={handleSubmit} isSubmitting={isRegistering} onBack={onExit} />
    </LoadingWhen>
  );
}
