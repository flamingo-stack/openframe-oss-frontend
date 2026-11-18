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
  if (mode === 'saas-tenant') return '/mingo';
  return '/auth';
}

/**
 * A SaaS tenant's shell (Manhattan v2) has no dashboard: `app/(app)/dashboard/page.tsx`
 * sends `/dashboard` to Start Work, but only in the browser, after the page has drawn the
 * old dashboard's skeleton and an empty page. Sent here first, a load of `/dashboard` (a
 * bookmark, a reload, an old link) lands on Start Work without drawing a page it leaves.
 * The client redirect stays for what this does not see (the native shells' static export,
 * a navigation inside the app).
 */
function shellRedirect(pathname: string): string | null {
  if (getMode() !== 'saas-tenant') return null;
  return pathname === '/dashboard' || pathname === '/dashboard/' ? '/mingo' : null;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const shellTarget = shellRedirect(pathname);
  if (shellTarget) {
    // The query string rides along, as below.
    const url = request.nextUrl.clone();
    url.pathname = shellTarget;
    return NextResponse.redirect(url);
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
