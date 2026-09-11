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
 * mobile flow only, copying them from the flow cookie the app itself started the login with. The
 * `error` param on that scheme URL is what the app's callback parser reads
 * (`completeTicketFlow` in native-login.ts): `USER_CANCELED` is the shell's own quiet-cancel code,
 * so a deliberate Back raises no toast; anything else becomes a message.
 */

export const MOBILE_AUTH_ERROR_PARAM = 'error';

export const MOBILE_AUTH_ERROR = {
  /** The person chose to leave. Same code the shell uses for a dismissed sheet: no toast. */
  USER_CANCELED: 'USER_CANCELED',
  /** The server session or flow cookie behind the page expired before it finished. */
  SESSION_EXPIRED: 'SESSION_EXPIRED',
} as const;

export type MobileAuthError = (typeof MOBILE_AUTH_ERROR)[keyof typeof MOBILE_AUTH_ERROR];

/** Schemes a page must never be talked into navigating to, whatever the URL says. */
const REJECTED_SCHEMES = new Set(['http', 'https', 'javascript', 'data', 'vbscript', 'file', 'blob']);

/**
 * The app's return address for this page, or null when this is not a mobile flow.
 *
 * Both params must be present and agree: `authMobile=true` says the flow is native, `redirectTo`
 * says where the app listens. Only a custom-scheme URL qualifies - an https `redirectTo` would just
 * open another web page inside the sheet, and the dangerous schemes are refused outright, so a
 * crafted link cannot turn the Back button into a navigation to somewhere else.
 */
export function readMobileAuthReturn(params: Pick<URLSearchParams, 'get'>): string | null {
  if (params.get('authMobile') !== 'true') return null;
  const redirectTo = params.get('redirectTo')?.trim();
  if (!redirectTo) return null;

  let url: URL;
  try {
    url = new URL(redirectTo);
  } catch {
    return null;
  }
  const scheme = url.protocol.replace(/:$/, '').toLowerCase();
  if (REJECTED_SCHEMES.has(scheme) || !/^[a-z][a-z0-9+.-]*$/.test(scheme)) return null;
  return url.href;
}

/** The return address with the outcome the app should read off it. */
export function mobileAuthReturnUrl(returnTo: string, error: MobileAuthError): string {
  const url = new URL(returnTo);
  url.searchParams.set(MOBILE_AUTH_ERROR_PARAM, error);
  return url.href;
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
