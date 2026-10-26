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
 * What the app says for the outcomes it words itself; any other code is an auth-server reference.
 * Every caller keeps the cancel quiet before asking for wording. Its entry is the code itself all the
 * same, so a caller that did ask would still stay quiet: `isUserCanceled` in use-auth matches it by
 * message.
 */
const APP_WORDED_OUTCOME: Partial<Record<string, string>> = {
  [MOBILE_AUTH_ERROR.USER_CANCELED]: MOBILE_AUTH_ERROR.USER_CANCELED,
  [MOBILE_AUTH_ERROR.SESSION_EXPIRED]: 'Your sign-in session expired. Please sign in again.',
} satisfies Record<MobileAuthError, string>;

/** The app's own sentence for an outcome it words itself; undefined for an auth-server reference. */
export function appWordedMessage(code: string): string | undefined {
  return Object.hasOwn(APP_WORDED_OUTCOME, code) ? APP_WORDED_OUTCOME[code] : undefined;
}

/**
 * The shape of a reference the auth server hands out: an `AuthErrorCode` name (`SSO_SESSION_EXPIRED`)
 * or an 8-character stored-message key (`7KQ2M9XD`). Both are identifiers, never a sentence, so a
 * value with a space, lowercase or punctuation is not something the server produced: not worth a round
 * trip, and not something to show. The app's own outcome codes (`MOBILE_AUTH_ERROR`) share the shape on
 * purpose, so this is also what tells a callback's `error` from text someone put there. The lookup is no
 * safety boundary: the server resolves anything it does not know to its generic entry, and a page
 * renders only what the server returns either way.
 */
const REFERENCE_SHAPE = /^[A-Z0-9_]{1,64}$/;

export function isAuthErrorRef(value: string | null | undefined): value is string {
  return typeof value === 'string' && REFERENCE_SHAPE.test(value);
}

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
