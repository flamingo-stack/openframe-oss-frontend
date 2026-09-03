'use client';

import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useCallback, useState } from 'react';
import { SsoOrganizationSetup } from '@/app/(auth)/auth/components/sso-organization-setup';
import { type AppleCredential, AppleRegisterError, appleNativeRegister } from '@/lib/native-login';
import { markPendingSignup } from '@/lib/posthog/posthog-events';

interface AppleNativeSignupSectionProps {
  /**
   * The verified Apple credential the exchange answered `registration_required` for. Held in
   * memory only — Apple's authorization code is single-use and must never reach a URL or storage.
   */
  credential: AppleCredential;
  /** Runs after tokens are stored, to leave the auth screen. */
  onRegistered: () => void;
  /**
   * Discards the credential and returns to the sign-in form. A route change cannot do this: from
   * the login page this section already renders AT `/auth/login`, so replacing that route is a
   * no-op and the parent's state would keep it mounted.
   */
  onExit: () => void;
}

/**
 * Organization form for a verified Apple identity that has no account yet.
 *
 * Rendered in place on the auth screen rather than at its own route: the credential cannot survive
 * a navigation, and putting a single-use authorization code in a URL would be worse than losing it.
 *
 * There is no email field. Apple already asserted the address and the gateway reads it from the
 * verified token — an input here would imply a choice the user does not have, and for a Hide My
 * Email user the address is a relay they have never seen and could not retype.
 */
export function AppleNativeSignupSection({ credential, onRegistered, onExit }: AppleNativeSignupSectionProps) {
  // Set once the register call has consumed the authorization code. Apple will not reissue it, so
  // this screen is finished either way and must stop offering a retry it cannot honour. Kept as a
  // separate flag from the message: an error carrying no message must still end the screen.
  const [isSpent, setIsSpent] = useState(false);
  const [spentMessage, setSpentMessage] = useState<string | null>(null);
  // The shared form's own busy flag only covers the availability re-check. This covers the register
  // call itself: without it the button re-enables mid-flight and a second tap would POST the same
  // single-use authorization code again.
  const [isRegistering, setIsRegistering] = useState(false);

  const handleSubmit = useCallback(
    async (values: { tenantName: string; tenantDomain: string }) => {
      setIsRegistering(true);
      try {
        await appleNativeRegister({ credential, ...values });
      } catch (error) {
        // A failure that did NOT redeem the authorization code (the gateway rejected the tenant
        // details before the exchange leg) is correctable in place — rethrow so the form surfaces
        // it and stays up with the credential still in memory.
        if (error instanceof AppleRegisterError && !error.credentialSpent) {
          setIsRegistering(false);
          throw error;
        }
        setIsSpent(true);
        setSpentMessage(error instanceof Error && error.message ? error.message : null);
        return;
      }
      // Server-confirmed registration — same marker the password path sets, so `signup_completed`
      // fires for a native Apple signup too.
      markPendingSignup();
      onRegistered();
    },
    [credential, onRegistered],
  );

  if (isSpent) {
    return (
      <div className="flex w-full flex-col gap-[var(--spacing-system-l)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-xl)]">
        <h1 className="tracking-[-0.64px] text-ods-text-primary text-h2">Couldn't create your organization</h1>
        <p className="text-ods-text-secondary text-h4">
          {spentMessage ? `${spentMessage} ` : ''}
          Sign in with Apple again to retry.
        </p>
        <Button variant="accent" fullWidth onClick={onExit}>
          Back to sign in
        </Button>
      </div>
    );
  }

  return (
    <SsoOrganizationSetup
      subtitle="Name your organization to finish signing in with Apple."
      onSubmit={handleSubmit}
      isSubmitting={isRegistering}
      onBack={onExit}
    />
  );
}
