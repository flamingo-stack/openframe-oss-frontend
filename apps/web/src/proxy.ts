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

  // RFC 9116 security contact (public/.well-known/security.txt): scanners and
  // researchers fetch it signed out, on any host, so it is open in every mode —
  // saas-shared would otherwise send it to `/auth`.
  if (pathname === '/.well-known/security.txt') {
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
 * Pages a SaaS tenant's shell (Manhattan v2) does not have, which forward to Start Work:
 * `/dashboard` (`app/(app)/dashboard/page.tsx`) and `/onboarding`
 * (`app/(app)/onboarding/page.tsx`, where the saas-gateway sends a login whose user has not
 * finished the tour). In the browser that forward runs only once the page mounts, behind the
 * page gates, and until then the shell draws the page it is leaving: the old dashboard's
 * skeleton, or an empty "Onboarding" column beside Start Work. Sent here first, a load of
 * either (a login, a bookmark, a reload, an old link) lands on Start Work without drawing it.
 * The client redirect stays for what this does not see (the native shells' static export,
 * a navigation inside the app).
 */
const SHELL_FORWARDED_PATHS = new Set(['/dashboard', '/dashboard/', '/onboarding', '/onboarding/']);

function shellRedirect(pathname: string): string | null {
  if (getMode() !== 'saas-tenant') return null;
  return SHELL_FORWARDED_PATHS.has(pathname) ? '/mingo' : null;
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
