/**
 * `/auth?email=` fills the sign-up's email field (a landing page's work email field hands its value over this way).
 *
 * An email must not stay in the address: GTM's pageview (PostHog) reads it, and the visit attribution records it as
 * the landing URL sent with the signup. So the root layout's `<head>` runs `signupEmailSeedScript()` before either: it
 * moves the value to sessionStorage and takes it off the address. The sign-up reads it once (`useSignupEmailPrefill`).
 */
import { useSyncExternalStore } from 'react';
import { routes } from '@/lib/routes';

export const SIGNUP_EMAIL_PARAM = 'email';
const STORAGE_KEY = 'of_signup_email';
/** The longest address there is (RFC 5321): anything longer is not one. */
const MAX_EMAIL_LENGTH = 254;

/** Server-safe: the root layout (a server component) emits it. Only the sign-up's own path is touched. */
export function signupEmailSeedScript(): string {
  const path = JSON.stringify(routes.auth.root);
  const param = JSON.stringify(SIGNUP_EMAIL_PARAM);
  const key = JSON.stringify(STORAGE_KEY);
  return `(function(){try{var u=new URL(location.href);if(u.pathname.replace(/\\/$/,'')!==${path})return;var e=u.searchParams.get(${param});if(e===null)return;u.searchParams.delete(${param});e=e.trim();if(e&&e.length<=${MAX_EMAIL_LENGTH})sessionStorage.setItem(${key},e);history.replaceState(history.state,'',u.pathname+u.search+u.hash);}catch(x){}})();`;
}

let taken: string | null | undefined;

/** The handed-over email, read once per page load and then removed from storage. */
function takeOnce(): string | null {
  if (taken === undefined) {
    try {
      taken = sessionStorage.getItem(STORAGE_KEY);
      sessionStorage.removeItem(STORAGE_KEY);
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
