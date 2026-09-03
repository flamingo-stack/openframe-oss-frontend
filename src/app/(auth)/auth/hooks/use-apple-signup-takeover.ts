'use client';

import { useCallback, useState } from 'react';
import { type AppleCredential, AppleRegistrationRequiredError } from '@/lib/native-login';
import { routes } from '@/lib/routes';

export interface AppleSignupTakeover {
  /** The verified credential awaiting an organization, or null when the normal form should render. */
  credential: AppleCredential | null;
  /**
   * Pass any error thrown out of `loginWithSso`. The no-account answer is captured and takes over
   * the screen; every other error is left alone, `loginWithSso` having already surfaced it.
   */
  capture: (error: unknown) => void;
  /** Leaves the auth screen after tokens are stored. */
  onRegistered: () => void;
  /** Discards the credential and returns to the sign-in form. */
  onExit: () => void;
}

/**
 * Holds a verified Apple identity that turned out to have no account, on either auth tab.
 *
 * Both tabs need it: signing up with Apple is the expected case on Sign Up, and on Login an Apple ID
 * that has never been used here answers the same way. The credential is memory-only — Apple's
 * authorization code is single-use, so it must never reach a route, storage, or a log.
 */
export function useAppleSignupTakeover(): AppleSignupTakeover {
  const [credential, setCredential] = useState<AppleCredential | null>(null);

  const capture = useCallback((error: unknown) => {
    if (error instanceof AppleRegistrationRequiredError) {
      setCredential(error.credential);
    }
  }, []);

  const onRegistered = useCallback(() => {
    // Same landing as a completed native login — the shell has already stored the tokens.
    window.location.replace(routes.dashboard);
  }, []);

  const onExit = useCallback(() => setCredential(null), []);

  return { credential, capture, onRegistered, onExit };
}
