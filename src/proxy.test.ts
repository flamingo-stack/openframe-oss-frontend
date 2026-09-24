import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it } from 'vitest';
import { proxy } from './proxy';

/**
 * The Edge allowlist is a deliberate second copy of `isRouteAllowedInCurrentMode`
 * (lib/app-mode.ts) — the two cannot share code, because that module reaches into
 * `platform.ts` for browser globals this runtime does not have.
 *
 * What it can share is a test. `app-mode.test.ts` pins the app-side copy; this pins
 * THIS one, so the pair cannot drift in silence: an exemption widened or narrowed on
 * one side now fails here or there.
 *
 * Driven through `proxy()` rather than the module-private `isAllowed`, so the thing
 * under test is what actually runs.
 */
function run(pathname: string, mode: string) {
  process.env.NEXT_PUBLIC_APP_MODE = mode;
  return proxy(new NextRequest(new URL(`https://openframe.ai${pathname}`)));
}

/** A redirect carries the target; a pass-through does not redirect at all. */
function redirectedTo(pathname: string, mode: string): string | null {
  const response = run(pathname, mode);
  return response.status === 307 || response.status === 308 || response.status === 302
    ? (response.headers.get('location') ?? '')
    : null;
}

afterEach(() => {
  delete process.env.NEXT_PUBLIC_APP_MODE;
});

describe('the /mobile allowlist in the Edge proxy', () => {
  it('lets the QR landing page through in saas-shared, which allows almost nothing else', () => {
    expect(redirectedTo('/mobile', 'saas-shared')).toBeNull();
    // `trailingSlash: true` is the form the export build serves.
    expect(redirectedTo('/mobile/', 'saas-shared')).toBeNull();
  });

  it('does not extend that to a route which merely shares the prefix', () => {
    // Segment match, not `startsWith`: this exemption sits above every mode rule, so a
    // prefix would hand any future `/mobile*` route a blanket pass.
    expect(redirectedTo('/mobile-onboarding', 'saas-shared')).toContain('/auth');
    expect(redirectedTo('/mobiles', 'saas-shared')).toContain('/auth');
  });

  it('keeps the page reachable in the tenant modes too', () => {
    for (const mode of ['oss-tenant', 'saas-tenant']) {
      expect(redirectedTo('/mobile', mode)).toBeNull();
    }
  });

  it('preserves the query string when it does redirect', () => {
    process.env.NEXT_PUBLIC_APP_MODE = 'saas-shared';
    const response = proxy(new NextRequest(new URL('https://openframe.ai/mobiles?fbclid=abc&utm_source=qr')));
    expect(response.headers.get('location')).toContain('fbclid=abc');
    expect(response.headers.get('location')).toContain('utm_source=qr');
  });
});
