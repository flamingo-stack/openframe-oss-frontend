/**
 * Handing an auth page back to the native app.
 *
 * A native login runs inside a shell-owned browser session (`ASWebAuthenticationSession`, or the
 * desktop shell's window) that closes ONLY when the page navigates to the app's custom scheme. The
 * happy path does that on its own: the gateway 302s the devTicket to `<scheme>://auth`. The ways
 * OUT of a page do not - a "Back to Login" that pushes the web login leaves the person stranded in
 * the sheet with nothing to tap but the system Cancel. So a page that can be shown mid-flow on
 * mobile reads the return address the server put in its URL and leaves through it instead.
 *
 * The server appends `authMobile=true` and `redirectTo=<scheme>://auth` to the page URL for a
 * mobile flow only, copying them from the flow cookie the app itself started the login with. They
 * travel in the URL rather than in the `pending` body so they survive the one case that needs them
 * most: `pending` answering 409.
 *
 * The page never navigates to that address itself. It hands it to the BFF's `/oauth/join-return`
 * (`authApiClient.ssoJoinReturnUrl`), which checks it against the redirect allow-list and 302s to
 * the app URI, or to the web login when it is not allow-listed - the same guard `/oauth/continue`
 * applies on the success path, and the open redirect a page-side `window.location = redirectTo`
 * would reopen.
 *
 * The `error` param the app's callback parser reads (`completeTicketFlow` in native-login.ts):
 * `USER_CANCELED` is the shell's own quiet-cancel code, so a deliberate Back raises no toast;
 * anything else becomes a message.
 */

export const MOBILE_AUTH_ERROR_PARAM = 'error';

export const MOBILE_AUTH_ERROR = {
  /** The person chose to leave. Same code the shell uses for a dismissed sheet: no toast. */
  USER_CANCELED: 'USER_CANCELED',
  /** The server session or flow cookie behind the page expired before it finished. */
  SESSION_EXPIRED: 'SESSION_EXPIRED',
} as const;

export type MobileAuthError = (typeof MOBILE_AUTH_ERROR)[keyof typeof MOBILE_AUTH_ERROR];

/**
 * The app's return address for this page, verbatim, or null when this is not a mobile flow.
 *
 * Both params must be present: `authMobile=true` says the flow is native, `redirectTo` says where
 * the app listens. Nothing is validated here on purpose - only the BFF knows the allow-list, and it
 * is the one that navigates; a crafted value gets it no further than the web login.
 */
export function readMobileAuthReturn(params: Pick<URLSearchParams, 'get'>): string | null {
  if (params.get('authMobile') !== 'true') return null;
  const redirectTo = params.get('redirectTo')?.trim();
  return redirectTo ? redirectTo : null;
}

/**
 * What the app tells the person when the callback carries an outcome instead of a ticket. The
 * cancel code is deliberately returned verbatim: `isUserCanceled` in use-auth matches it by message
 * and keeps it silent.
 */
export function mobileAuthErrorMessage(code: string): string {
  switch (code) {
    case MOBILE_AUTH_ERROR.USER_CANCELED:
      return MOBILE_AUTH_ERROR.USER_CANCELED;
    case MOBILE_AUTH_ERROR.SESSION_EXPIRED:
      return 'Your sign-in session expired. Please sign in again.';
    default:
      return `Sign-in could not be completed (${code}).`;
  }
}
