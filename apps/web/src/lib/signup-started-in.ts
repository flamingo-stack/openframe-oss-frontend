/**
 * Where a sign-up began, when it began in the desktop app and finishes in the browser.
 *
 * The desktop app hands its password sign-up to the shared host's page in the default browser
 * (`signup-in-browser.ts`), so the backend sees a browser request and would record the platform as web. The hand-off
 * link names the app instead: `/auth?started_in=desktop`. The root layout's `<head>` runs `signupStartedInSeedScript()`
 * before GTM and the attribution read the address: it takes the value off the address and keeps it in this tab's
 * sessionStorage. The registration sends it as `attribution.startedIn` (`registration-attribution.ts`), the password
 * body and the SSO continue URL alike, and a password sign-up that went through removes it (`clearSignupStartedIn`).
 *
 * sessionStorage, not localStorage: the marker belongs to the sign-up this tab is making. It survives a reload and the
 * same-tab trip to Google or Microsoft and back, while a visitor who later opens the page in a tab of their own sends
 * nothing. Only `desktop` exists: the phone app has no sign-up (its App Store review notes).
 *
 * Server-safe, as the root layout (a server component) emits the script.
 */
import { routes } from './routes';

export const SIGNUP_STARTED_IN_PARAM = 'started_in';
export const SIGNUP_STARTED_IN_STORAGE_KEY = 'of_signup_started_in';

/** The apps a sign-up can begin in, as the backend's `Touchpoint.startedIn` takes them. */
export const SIGNUP_STARTED_IN_VALUES = ['desktop'] as const;

export type SignupStartedIn = (typeof SIGNUP_STARTED_IN_VALUES)[number];

function isSignupStartedIn(value: string | null | undefined): value is SignupStartedIn {
  return (SIGNUP_STARTED_IN_VALUES as readonly string[]).includes(value ?? '');
}

/**
 * Only the sign-up's own path is touched. Any `started_in` leaves the address; only a known value is kept. The address
 * is cleaned before the value is stored, so storage that refuses the write still leaves a clean address.
 */
export function signupStartedInSeedScript(): string {
  const path = JSON.stringify(routes.auth.root);
  const param = JSON.stringify(SIGNUP_STARTED_IN_PARAM);
  const key = JSON.stringify(SIGNUP_STARTED_IN_STORAGE_KEY);
  const values = JSON.stringify(SIGNUP_STARTED_IN_VALUES);
  return `(function(){try{var u=new URL(location.href);if(u.pathname.replace(/\\/$/,'')!==${path})return;var v=u.searchParams.get(${param});if(v===null)return;u.searchParams.delete(${param});history.replaceState(history.state,'',u.pathname+u.search+u.hash);v=v.trim();if(${values}.indexOf(v)>=0)sessionStorage.setItem(${key},v);}catch(x){}})();`;
}

/**
 * The app this tab's sign-up began in, or `undefined`. Never throws: it runs inside every registration, and storage
 * that is missing or blocked must cost the marker, not the sign-up.
 */
export function readSignupStartedIn(): SignupStartedIn | undefined {
  try {
    const value = window.sessionStorage.getItem(SIGNUP_STARTED_IN_STORAGE_KEY);
    return isSignupStartedIn(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

/** Forget the marker once the sign-up it belongs to went through, so a later sign-up in this tab is not counted too. */
export function clearSignupStartedIn(): void {
  try {
    window.sessionStorage.removeItem(SIGNUP_STARTED_IN_STORAGE_KEY);
  } catch {
    // Storage that cannot be reached holds nothing to clear.
  }
}
