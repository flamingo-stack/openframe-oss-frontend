import { NextRequest, NextResponse } from 'next/server';

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

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
