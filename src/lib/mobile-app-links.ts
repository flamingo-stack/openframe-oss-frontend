import { routes } from '@/lib/routes';

/** Published listings for the OpenFrame Console mobile app. */
export const APP_STORE_URL = 'https://apps.apple.com/us/app/openframe-console/id6801064262';
export const GOOGLE_PLAY_URL = 'https://play.google.com/store/apps/details?id=ai.openframe.mobile';

/**
 * The one URL the install QR code encodes, and the only one printed anywhere.
 *
 * A QR code carries a single fixed string, so the per-OS choice has to happen at
 * whatever answers this URL, not in the code: the shared gateway matches
 * `Path=/mobile` against a `User-Agent` predicate and 302s to the store above,
 * falling through to `/mobile` (the page) for everything it cannot classify.
 *
 * Absolute and on the apex host, deliberately NOT derived from
 * `NEXT_PUBLIC_SHARED_HOST_URL`: tenant gateway hosts are learned at login, that env
 * var names the `auth.` subdomain and is empty on an OSS tenant, and a printed code
 * must point at production whichever deployment rendered the page it came from. Once
 * printed it cannot be changed. `components/mobile-app-qr.tsx` draws its QR
 * inline; regenerate that path data if this value ever changes.
 */
export const MOBILE_APP_INSTALL_URL = `https://openframe.ai${routes.mobileApp}`;

/** {@link MOBILE_APP_INSTALL_URL} as it is printed for a human to read or type. */
export const MOBILE_APP_INSTALL_HOST_PATH = MOBILE_APP_INSTALL_URL.replace(/^https:\/\//, '');

/**
 * The store for a phone that reached this page, or `null` to keep showing it.
 *
 * A COMPLETE client-side fallback, not a patch over the gateway: the gateway's
 * `User-Agent` predicates normally 302 before this page renders, but they are backend
 * config that may be absent or mis-scoped, so do not delete the iPhone/Android branches
 * as "redundant". One case the gateway provably cannot cover on its own: iPadOS 13+
 * Safari requests desktop sites by default and sends a `Macintosh` user agent,
 * indistinguishable from a Mac server-side — only a touch-capable Mac is an iPad, and
 * `maxTouchPoints` is a browser API.
 */
export function resolveMobileStoreUrl(userAgent: string, maxTouchPoints: number): string | null {
  if (/iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1)) {
    return APP_STORE_URL;
  }
  if (/Android/i.test(userAgent)) {
    return GOOGLE_PLAY_URL;
  }
  return null;
}
