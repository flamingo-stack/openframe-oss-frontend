'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { isLoginOnlyMobileShell } from '@/lib/app-mode';
import {
  AppleRegistrationRequiredError,
  type PendingSsoSignup,
  SsoRegistrationRequiredError,
} from '@/lib/native-login';
import { routes } from '@/lib/routes';

export interface SsoSignupTakeover {
  /** The verified identity awaiting an organization, or null when the normal form should render. */
  pending: PendingSsoSignup | null;
  /**
   * Pass any error thrown out of `loginWithSso`. A no-account answer — from either the native Apple
   * sheet or a browser flow — is captured and takes over the screen; every other error is left
   * alone, `loginWithSso` having already surfaced it. In a login-only mobile build the answer goes
   * to the no-account notice instead, and `pending` stays null.
   */
  capture: (error: unknown) => void;
  /** Leaves the auth screen after tokens are stored. */
  onRegistered: () => void;
  /** Discards the pending identity and returns to the sign-in form. */
  onExit: () => void;
}

/**
 * Holds a verified SSO identity that turned out to have no account, on either auth tab.
 *
 * Both tabs need it: signing up is the expected case on Sign Up, and on Login an identity that has
 * never been used here answers the same way. One hook for both origins is what keeps the two
 * signup screens identical — same place in the layout, same tabs, same way back — regardless of
 * whether the identity arrived as an Apple credential or a signup ticket.
 *
 * Memory-only: Apple's authorization code is single-use and the ticket names a live server-side
 * identity, so neither may reach a route, storage, or a log.
 *
 * A login-only mobile build never holds the identity at all. App Review rejected in-app organization
 * registration (3.1.1/3.1.3), so there is nothing to finish: the credential or ticket is dropped on
 * capture — both expire on their own — and the person lands on the no-account notice.
 */
export function useSsoSignupTakeover(): SsoSignupTakeover {
  const router = useRouter();
  const [pending, setPending] = useState<PendingSsoSignup | null>(null);

  const capture = useCallback(
    (error: unknown) => {
      const isNoAccount =
        error instanceof AppleRegistrationRequiredError || error instanceof SsoRegistrationRequiredError;
      // A plain call, not `useLoginOnlyMobileShell()`: that hook's `false` exists only for the
      // prerendered render pass. Both errors come solely from `nativeLogin`, which `loginWithSso`
      // reaches only after `isAppShell()` has detected and memoized the shell for the document, so
      // this reads the same cached answer that routed the login natively.
      if (isNoAccount && isLoginOnlyMobileShell()) {
        router.push(routes.auth.noAccount);
      } else if (error instanceof AppleRegistrationRequiredError) {
        setPending({ kind: 'apple', credential: error.credential });
      } else if (error instanceof SsoRegistrationRequiredError) {
        setPending({ kind: 'ticket', ticket: error.signupTicket });
      }
    },
    [router],
  );

  const onRegistered = useCallback(() => {
    // Same landing as a completed native login — the shell has already stored the tokens.
    window.location.replace(routes.dashboard);
  }, []);

  const onExit = useCallback(() => setPending(null), []);

  return { pending, capture, onRegistered, onExit };
}
