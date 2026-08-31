import { isNonCookieableHost, toRegistrableBaseDomain } from '@flamingo-stack/openframe-frontend-core/platform-domains';
import { type CookieAttributes, readCookie, writeCookie } from './cookies';

/**
 * Partner-referral capture: `?ref=<code>` on any OpenFrame surface → the `of_ref` cookie, read
 * back at signup and sent as `attribution.ref` (see `registration-attribution.ts`).
 *
 * **Why a cookie**, when every other attribution signal in this app rides localStorage: the
 * referral link lands on the marketing site (`openframe.ai`) but is redeemed on the signup app
 * (`auth.openframe.ai`). localStorage is origin-scoped, so it cannot make that subdomain hop.
 * A cookie scoped to the registrable base domain (`.openframe.ai`) can — which is exactly the
 * requirement: one referred visit is enough, and every later visit from any other source still
 * registers under that partner until the window expires.
 *
 * **The browser writes it here**, because this app has no server-side seam to write it from:
 * it also ships as a static export for the native shells, so there are no route handlers, and
 * the middleware is on its way out. The cost is Safari's ITP, which caps a cookie written from
 * `document.cookie` at 7 days — so a referral first seen HERE gets a 7-day window on Safari
 * instead of 90.
 *
 * That is a survivable trade because this is the redemption surface, not the acquisition one:
 * partner links land on the marketing site, which writes the same cookie from a server route
 * handler at its full lifetime, and this app then only reads it. Only a partner who links
 * straight at signup degrades — and only on Safari.
 *
 * Which is also why {@link captureReferralFromUrl} never rewrites an unchanged value: doing so
 * would take the marketing site's server-set 90-day cookie and hand it back to ITP as a 7-day
 * one. A visitor arriving here on a referral already stored is left alone.
 *
 * **Last touch wins.** A `?ref=` visit overwrites whatever was stored and restarts the 90 days;
 * a visit *without* `?ref=` never clears anything. This is the default of every referral
 * platform (Rewardful, FirstPromoter, Tolt) for a reason: credit belongs to the partner whose
 * click actually preceded the signup, and a first-touch cookie would otherwise lock a visitor
 * to a stale partner for three months, so the partner who really converted them gets nothing.
 * Changing this policy is a one-line change here — the writers do not decide it, this file does.
 */

/** Query parameter carried by partner links. */
export const REFERRAL_URL_PARAM = 'ref';

/** Cookie name; shared with the marketing site, which writes the same cookie on its own hosts. */
export const REFERRAL_COOKIE_NAME = 'of_ref';

/** 90 days — the attribution window a partner click stays valid for. */
export const REFERRAL_COOKIE_MAX_AGE_SECONDS = 90 * 24 * 60 * 60;

export const REFERRAL_CODE_MAX_LENGTH = 64;

/**
 * A referral code goes straight into a `Set-Cookie` header and later into the registration
 * payload, so it is validated rather than escaped: anything outside this set (`;` and `,` above
 * all, which would let a crafted link append cookie attributes of its own) is dropped entirely.
 */
const REFERRAL_CODE_PATTERN = /^[A-Za-z0-9._-]+$/;

/** Returns the code when it is a plausible partner code, `undefined` for anything else. */
export function sanitizeReferralCode(raw: string | null | undefined): string | undefined {
  const trimmed = raw?.trim();
  if (!trimmed || trimmed.length > REFERRAL_CODE_MAX_LENGTH) return undefined;
  return REFERRAL_CODE_PATTERN.test(trimmed) ? trimmed : undefined;
}

/**
 * Cookie `Domain` for a host: the dotted registrable base (`auth.openframe.ai` → `.openframe.ai`),
 * which is what lets the marketing site and the signup app see the same cookie. `undefined` —
 * a host-only cookie — for hosts a browser refuses a `Domain` on (localhost, private IPs,
 * `*.vercel.app`); dev and preview run on a single host anyway, so nothing is lost there.
 */
export function resolveReferralCookieDomain(hostname: string): string | undefined {
  if (!hostname || isNonCookieableHost(hostname)) return undefined;
  const base = toRegistrableBaseDomain(hostname);
  return base ? `.${base}` : undefined;
}

/**
 * The cookie to write for `code` as seen from `hostname`. Not HttpOnly on purpose — the signup
 * page reads it from JavaScript to build the registration payload.
 */
export function buildReferralCookie(code: string, hostname: string, options: { secure: boolean }): CookieAttributes {
  return {
    name: REFERRAL_COOKIE_NAME,
    value: code,
    domain: resolveReferralCookieDomain(hostname),
    maxAgeSeconds: REFERRAL_COOKIE_MAX_AGE_SECONDS,
    path: '/',
    sameSite: 'lax',
    secure: options.secure,
  };
}

/** The stored referral code, re-validated on read so a hand-edited cookie can't reach the API. */
export function readReferralCode(): string | undefined {
  return sanitizeReferralCode(readCookie(REFERRAL_COOKIE_NAME));
}

/**
 * Store the referral carried by the current URL. Called from the app-wide attribution capture
 * on every page load, and safe there: without `?ref=` it does nothing, and it skips the write
 * when the cookie already holds this exact code — see the ITP note at the top of the file.
 */
export function captureReferralFromUrl(): void {
  if (typeof window === 'undefined') return;

  let code: string | undefined;
  try {
    code = sanitizeReferralCode(new URLSearchParams(window.location.search).get(REFERRAL_URL_PARAM));
  } catch {
    return;
  }

  if (!code || code === readCookie(REFERRAL_COOKIE_NAME)) return;

  writeCookie(buildReferralCookie(code, window.location.hostname, { secure: window.location.protocol === 'https:' }));
}
