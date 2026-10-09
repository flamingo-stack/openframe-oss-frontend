import { getPlatformUrl } from '@flamingo-stack/openframe-frontend-core/platform-domains';
import {
  DOWNLOAD_PAGE_PATH,
  DOWNLOAD_PAGE_STORE_PARAM,
  LEGACY_MOBILE_APP_INSTALL_PATH,
  resolveMobileStoreUrl,
} from '@flamingo-stack/openframe-frontend-core/utils/mobile-app';
import { type NextRequest, NextResponse } from 'next/server';

type AppMode = 'oss-tenant' | 'saas-tenant' | 'saas-shared';

function getMode(): AppMode {
  const raw = process.env.NEXT_PUBLIC_APP_MODE as AppMode | undefined;
  return (raw as AppMode) || 'oss-tenant';
}

function isAllowed(pathname: string): boolean {
  const mode = getMode();

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/assets') ||
    pathname.startsWith('/icons') ||
    pathname === '/robots.txt'
  ) {
    return true;
  }

  // Account-deletion instructions: reachable in every mode, signed out. Both app
  // stores require a deletion URL that resolves in a browser with no app install
  // and no account, and the canonical one is on the saas-shared host — the only
  // host identical for every tenant, and the mode that otherwise redirects
  // everything but `/auth` away. Mirrors `isRouteAllowedInCurrentMode`
  // (lib/app-mode.ts); the two allowlists are deliberately separate because this
  // one runs in the Edge runtime and must not pull in browser globals.
  if (pathname.startsWith('/account-deletion')) {
    return true;
  }

  if (mode === 'saas-shared') {
    return pathname.startsWith('/auth') || pathname === '/';
  }

  if (mode === 'saas-tenant') {
    return !pathname.startsWith('/auth');
  }

  return true;
}

function defaultRedirect(): string {
  const mode = getMode();
  if (mode === 'saas-shared') return '/auth';
  if (mode === 'saas-tenant') return '/dashboard';
  return '/auth';
}

/**
 * Where the old mobile-app install address goes. `/mobile` is what the "get the app"
 * notifications already sent point at, on the apex host the saas gateway serves from
 * this app, so it answers in EVERY mode and with no session. (The install QR code now
 * encodes the download page itself.)
 *
 * It is a redirect, not a page: a phone goes to its store, and everyone else to the
 * website's download page, which lists every installer. That page gets the
 * `store` parameter so it can still forward the one visitor a server cannot
 * classify: iPadOS Safari asks for desktop sites by default and sends a
 * `Macintosh` User-Agent, and only the browser's touch points tell it from a Mac.
 *
 * The rest of the query string rides along (ad and campaign parameters).
 */
function mobileInstallRedirect(request: NextRequest): NextResponse {
  const store = resolveMobileStoreUrl(request.headers.get('user-agent'));
  if (store) return NextResponse.redirect(store);

  const target = new URL(DOWNLOAD_PAGE_PATH, getPlatformUrl('flamingo', { environment: 'production' }));
  request.nextUrl.searchParams.forEach((value, key) => {
    target.searchParams.append(key, value);
  });
  target.searchParams.set(DOWNLOAD_PAGE_STORE_PARAM, '1');
  return NextResponse.redirect(target);
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Segment match, not a prefix: `startsWith('/mobile')` would also catch a future
  // `/mobile-onboarding`. The trailing-slash form is what `trailingSlash: true` serves.
  if (pathname === LEGACY_MOBILE_APP_INSTALL_PATH || pathname === `${LEGACY_MOBILE_APP_INSTALL_PATH}/`) {
    return mobileInstallRedirect(request);
  }

  if (!isAllowed(pathname)) {
    // clone() carries the query string over and only `pathname` is reassigned — deliberately.
    // Ad traffic lands here as `/something?fbclid=…&utm_source=…`; building a fresh URL, or
    // redirecting to a bare string, would strip those and the Meta pixel would never write
    // the `_fbc` cookie for that visit. See src/lib/registration-attribution.ts.
    const url = request.nextUrl.clone();
    url.pathname = defaultRedirect();
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/|static/|favicon|assets/|icons/|robots\\.txt$).*)'],
};
