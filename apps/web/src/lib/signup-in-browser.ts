/**
 * Password sign-up from the desktop and mobile apps finishes in the system browser.
 *
 * The edge firewall refuses `POST /sas/oauth/register` without a reCAPTCHA token (`recaptcha.ts`), and a shell can
 * never get one: its CSP does not admit Google's script, and a key only answers for the web domains it lists. So in a
 * shell the sign-up's email step opens the shared host's own sign-up page with that email filled in
 * (`signup-email-seed.ts`), where the token is read as on the web. Provider sign-up is not behind the firewall rule
 * and stays in the app.
 *
 * The desktop app's link also says the sign-up began there (`started_in=desktop`, `signup-started-in.ts`): the browser's
 * request would otherwise be recorded as a web sign-up. The phone app has no sign-up, so its link names nothing.
 *
 * Without a shared host (a self-hosted build) there is no firewall rule either, and the form stays in the app.
 */

import { isAppShell, isDesktopShell } from './platform';
import { routes } from './routes';
import { runtimeEnv } from './runtime-config';
import { SIGNUP_EMAIL_PARAM } from './signup-email-seed';
import { SIGNUP_STARTED_IN_PARAM } from './signup-started-in';

function sharedHost(): string {
  return runtimeEnv.sharedHostUrl().replace(/\/+$/, '');
}

/** Whether this build hands the password sign-up to the browser. */
export function signupContinuesInBrowser(): boolean {
  return isAppShell() && sharedHost() !== '';
}

/** The shared host's sign-up page, with the email the app already took and, from the desktop app, where it began. */
export function signupInBrowserUrl(email: string): string {
  const query = new URLSearchParams();
  if (email) query.set(SIGNUP_EMAIL_PARAM, email);
  if (isDesktopShell()) query.set(SIGNUP_STARTED_IN_PARAM, 'desktop');
  const search = query.toString();
  // Trailing slash: the canonical form under `trailingSlash: true`.
  return `${sharedHost()}${routes.auth.root}/${search ? `?${search}` : ''}`;
}

/**
 * A plain `window.open` of a known https URL: the desktop shell routes it to the default browser and the mobile
 * shell's `ExternalLinks` plugin to the in-app browser (SFSafariViewController, a Custom Tab), both real browsers on
 * the shared host's origin. Not `openDeferredTab()`: the desktop shell denies its blank placeholder tab.
 */
export function openSignupInBrowser(email: string): void {
  window.open(signupInBrowserUrl(email), '_blank', 'noopener,noreferrer');
}
