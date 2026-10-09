import { afterEach, describe, expect, it, vi } from 'vitest';

const shell = vi.hoisted(() => ({ kind: 'web' as 'web' | 'mobile' | 'desktop' }));

vi.mock('./platform', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  isAppShell: () => shell.kind !== 'web',
  isMobileShell: () => shell.kind === 'mobile',
}));

import { isLoginOnlyMobileShell, isMobileAuthLoginOnly, isRouteAllowedInCurrentMode } from './app-mode';

/**
 * `window.__ENV` is what next-runtime-env's `env()` reads in the browser. Replaces the
 * whole object, so one variable at a time — no test here needs two.
 */
function setEnv(key: 'NEXT_PUBLIC_MOBILE_AUTH_UI' | 'NEXT_PUBLIC_APP_MODE', value: string | undefined) {
  window.__ENV = (value === undefined ? {} : { [key]: value }) as typeof window.__ENV;
}

/**
 * The switch between the login-only mobile auth screens and the tabbed sign-up flow App Review
 * rejected. The default is the part that matters: a build that forgets the variable must ship the
 * compliant screens.
 */
describe('mobile auth UI switch', () => {
  afterEach(() => {
    setEnv('NEXT_PUBLIC_MOBILE_AUTH_UI', undefined);
    shell.kind = 'web';
  });

  it('is login-only when the variable is unset, empty or unrecognised', () => {
    for (const value of [undefined, '', 'login-only', 'Legacy']) {
      setEnv('NEXT_PUBLIC_MOBILE_AUTH_UI', value);
      expect(isMobileAuthLoginOnly()).toBe(true);
    }
  });

  it('restores the legacy screens only for exactly `legacy`', () => {
    setEnv('NEXT_PUBLIC_MOBILE_AUTH_UI', 'legacy');
    expect(isMobileAuthLoginOnly()).toBe(false);
  });

  it('applies to the mobile shell only — the web and the desktop shell keep sign-up', () => {
    setEnv('NEXT_PUBLIC_MOBILE_AUTH_UI', undefined);
    shell.kind = 'mobile';
    expect(isLoginOnlyMobileShell()).toBe(true);
    shell.kind = 'desktop';
    expect(isLoginOnlyMobileShell()).toBe(false);
    shell.kind = 'web';
    expect(isLoginOnlyMobileShell()).toBe(false);

    setEnv('NEXT_PUBLIC_MOBILE_AUTH_UI', 'legacy');
    shell.kind = 'mobile';
    expect(isLoginOnlyMobileShell()).toBe(false);
  });
});

/**
 * `/mobile` (the install QR code's address) has no page: `proxy.ts` redirects it before
 * the app renders, so the app-side allowlist carries no exemption for it. In saas-shared
 * mode it is as closed as every other route but `/auth`.
 */
describe('the mode allowlist in saas-shared mode', () => {
  afterEach(() => {
    setEnv('NEXT_PUBLIC_APP_MODE', undefined);
  });

  it('allows the auth routes and nothing the proxy answers on its own', () => {
    setEnv('NEXT_PUBLIC_APP_MODE', 'saas-shared');
    expect(isRouteAllowedInCurrentMode('/auth')).toBe(true);
    expect(isRouteAllowedInCurrentMode('/mobile')).toBe(false);
    expect(isRouteAllowedInCurrentMode('/mobile-onboarding')).toBe(false);
  });
});
