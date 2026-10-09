import {
  APP_STORE_URL,
  DOWNLOAD_PAGE_PATH,
  DOWNLOAD_PAGE_STORE_PARAM,
  GOOGLE_PLAY_URL,
} from '@flamingo-stack/openframe-frontend-core/utils/mobile-app';
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

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile Safari';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36';
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15';

function mobileRedirect(path: string, mode: string, userAgent: string): string {
  process.env.NEXT_PUBLIC_APP_MODE = mode;
  const request = new NextRequest(new URL(`https://openframe.ai${path}`), { headers: { 'user-agent': userAgent } });
  return proxy(request).headers.get('location') ?? '';
}

/**
 * `/mobile` is the address the printed install QR code and the "get the app"
 * notification carry. It has no page of its own any more: a phone is sent to its
 * store and everyone else to the website's download page.
 */
describe('the /mobile install address in the Edge proxy', () => {
  it('sends a phone to its store, in every mode', () => {
    for (const mode of ['saas-shared', 'saas-tenant', 'oss-tenant']) {
      expect(mobileRedirect('/mobile', mode, IPHONE)).toBe(APP_STORE_URL);
      expect(mobileRedirect('/mobile', mode, ANDROID)).toBe(GOOGLE_PLAY_URL);
    }
  });

  it('sends everyone else to the download page, asking it to forward a tablet it can detect', () => {
    // `trailingSlash: true` is the form the build serves.
    for (const path of ['/mobile', '/mobile/']) {
      const target = new URL(mobileRedirect(path, 'saas-shared', MAC));
      expect(target.pathname).toBe(DOWNLOAD_PAGE_PATH);
      expect(target.searchParams.has(DOWNLOAD_PAGE_STORE_PARAM)).toBe(true);
    }
  });

  it('carries the query string to the download page', () => {
    const target = new URL(mobileRedirect('/mobile?utm_source=qr&fbclid=abc', 'saas-shared', MAC));
    expect(target.searchParams.get('utm_source')).toBe('qr');
    expect(target.searchParams.get('fbclid')).toBe('abc');
  });

  it('does not catch a route which merely shares the prefix', () => {
    // Segment match, not `startsWith`: these fall through to the mode rules.
    expect(redirectedTo('/mobile-onboarding', 'saas-shared')).toContain('/auth');
    expect(redirectedTo('/mobiles', 'saas-shared')).toContain('/auth');
  });

  it('preserves the query string when a mode rule redirects', () => {
    process.env.NEXT_PUBLIC_APP_MODE = 'saas-shared';
    const response = proxy(new NextRequest(new URL('https://openframe.ai/mobiles?fbclid=abc&utm_source=qr')));
    expect(response.headers.get('location')).toContain('fbclid=abc');
    expect(response.headers.get('location')).toContain('utm_source=qr');
  });
});
