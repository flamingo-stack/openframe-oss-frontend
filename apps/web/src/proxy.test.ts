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

/**
 * `/mobile` was the mobile-app install page. It is gone (the website's download page
 * replaced it), so it carries no exemption: it is an ordinary path under the mode rules.
 */
describe('the mode rules in the Edge proxy', () => {
  it('gives the removed /mobile path no exemption in saas-shared', () => {
    expect(redirectedTo('/mobile', 'saas-shared')).toContain('/auth');
    expect(redirectedTo('/mobile/', 'saas-shared')).toContain('/auth');
  });

  it('keeps the account-deletion page reachable in saas-shared, which allows almost nothing else', () => {
    expect(redirectedTo('/account-deletion', 'saas-shared')).toBeNull();
  });

  it('preserves the query string when it does redirect', () => {
    process.env.NEXT_PUBLIC_APP_MODE = 'saas-shared';
    const response = proxy(new NextRequest(new URL('https://openframe.ai/mobiles?fbclid=abc&utm_source=qr')));
    expect(response.headers.get('location')).toContain('fbclid=abc');
    expect(response.headers.get('location')).toContain('utm_source=qr');
  });
});
