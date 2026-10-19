/**
 * The browser end of a desktop sign-in.
 *
 * The desktop shell runs the login in the user's default browser and receives the result on its own
 * scheme. Redirected straight there, the tab keeps whatever page committed last - for OpenFrame SSO
 * the credential form, which reads as a failed login - because a navigation to an external protocol
 * commits no document. So the desktop login asks the gateway to finish on a page of ours instead
 * (`desktopAuthReturnTarget`), and that page shows the outcome and passes it on to the scheme.
 *
 * The target ends in `#`. The gateway appends every outcome with `?` or `&`, depending on whether the
 * target already contains a `?`, so behind a bare `#` it lands in the fragment (`…/#?devTicket=…`),
 * which a browser never sends with the request: the ticket stays out of server logs. Only the
 * fragment is read. A ticket in the query would also be redeemed by the root layout's
 * `DevTicketObserver` wherever that is enabled, spending it in the browser before the app gets it.
 */
import { MOBILE_AUTH_ERROR_PARAM } from './mobile-auth-return';
import { routes } from './routes';

/**
 * The desktop shell's registered scheme: `URI_SCHEME` in `apps/desktop/src-tauri/src/lib.rs`. A
 * constant on purpose. The page is served by the web deployment, where `runtimeEnv.appScheme()` is the
 * mobile default, and a scheme taken from the URL would let any link launch any protocol handler with
 * our page in front of it.
 */
export const DESKTOP_APP_SCHEME = 'openframe-console';

/**
 * What the gateway sends back: a sign-in, an identity with no account yet, or an outcome code.
 * `incomplete` is a landing with none of them (the gateway issued nothing), handed on as a bare
 * callback so the shell fails the login at once instead of waiting out its timeout. `none` is a visit
 * with no fragment at all - typed in, or a reload after the strip - and launches nothing, so a stray
 * visit cannot end a sign-in that is waiting.
 */
export type DesktopAuthReturn =
  | { kind: 'signed-in'; appUrl: string }
  | { kind: 'signup'; appUrl: string }
  | { kind: 'error'; code: string; appUrl: string }
  | { kind: 'incomplete'; appUrl: string }
  | { kind: 'none' };

/** An outcome code reaches the app's toast and the auth server's lookup: an identifier, never a sentence. */
export function isOutcomeCode(code: string): boolean {
  return /^[A-Z0-9_]{1,64}$/.test(code);
}

/**
 * The `redirectTo` a desktop login asks the gateway for. The SaaS gateway honours it only when it is in
 * `openframe.gateway.redirect.allowed-uris` character for character, trailing `/#` included; anything
 * else is rewritten to the tenant root and the login hangs until the shell times out.
 */
export function desktopAuthReturnTarget(sharedHostUrl: string): string {
  return `${sharedHostUrl.replace(/\/+$/, '')}${routes.auth.desktopReturn}/#`;
}

function schemeUrl(key: string, value: string): string {
  return `${DESKTOP_APP_SCHEME}://auth?${new URLSearchParams({ [key]: value })}`;
}

/**
 * The address the page was loaded at, which is what `readDesktopAuthReturn` has to read. On hydration the
 * app router rewrites the address bar from `pathname + search + hash`, and `hash` is '' for a bare `#`:
 * a landing with nothing has lost its fragment, and reads as a stray visit, before the page looks. The
 * navigation entry keeps the URL as loaded. It is consulted only when the address has no fragment left,
 * so a browser that records the entry without one cannot cost a landing that kept it, and only when it
 * is this page's: after a client-side navigation here it belongs to the page the app was loaded at.
 */
export function landingLocation(
  location: Pick<Location, 'hash' | 'href' | 'pathname'>,
  navigation: Pick<PerformanceEntry, 'name'> | undefined,
): Pick<Location, 'hash' | 'href'> {
  if (location.href.includes('#') || !navigation) return location;
  const loaded = new URL(navigation.name);
  return loaded.pathname === location.pathname ? loaded : location;
}

/** Reads the hand-off the gateway put in the page's fragment and builds the scheme URL that carries it on to the app. */
export function readDesktopAuthReturn(location: Pick<Location, 'hash' | 'href'>): DesktopAuthReturn {
  // `hash` is '' both without a fragment and for a bare `#`, which is what a landing with nothing looks like.
  if (!location.href.includes('#')) return { kind: 'none' };
  const params = new URLSearchParams(location.hash.replace(/^#\??/, ''));

  const devTicket = params.get('devTicket');
  if (devTicket) return { kind: 'signed-in', appUrl: schemeUrl('devTicket', devTicket) };

  const signupTicket = params.get('signupTicket');
  if (signupTicket) return { kind: 'signup', appUrl: schemeUrl('signupTicket', signupTicket) };

  const code = params.get(MOBILE_AUTH_ERROR_PARAM);
  if (code && isOutcomeCode(code)) {
    return { kind: 'error', code, appUrl: schemeUrl(MOBILE_AUTH_ERROR_PARAM, code) };
  }

  return { kind: 'incomplete', appUrl: `${DESKTOP_APP_SCHEME}://auth` };
}

/**
 * Hands a scheme URL to the browser, which asks the OS to open the app. The page stays: a navigation to
 * an external protocol does not replace the document.
 */
export function launchDesktopApp(url: string): void {
  window.location.assign(url);
}
