'use client';

import { useSyncExternalStore } from 'react';
import { SIGNUP_EMAIL_STORAGE_KEY } from '@/lib/signup-email-seed';

let taken: string | null | undefined;

/** The handed-over email (`signup-email-seed.ts`), read once per page load and then removed from storage. */
function takeOnce(): string | null {
  if (taken === undefined) {
    try {
      taken = sessionStorage.getItem(SIGNUP_EMAIL_STORAGE_KEY);
      sessionStorage.removeItem(SIGNUP_EMAIL_STORAGE_KEY);
    } catch {
      taken = null;
    }
  }
  return taken;
}

const subscribeToNothing = () => () => {};

/** The email handed to the sign-up, or null. Null on the server and while hydrating, so the markup matches. */
export function useSignupEmailPrefill(): string | null {
  return useSyncExternalStore(subscribeToNothing, takeOnce, () => null);
}

/** For tests: forget the email read on this page load. */
export function resetSignupEmailPrefill(): void {
  taken = undefined;
}
