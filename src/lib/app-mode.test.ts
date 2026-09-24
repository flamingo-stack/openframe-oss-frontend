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
 * `/mobile` is the QR landing page: public, session-less, and exempt from the mode rules
 * below it in the guard. The exemption has to stop at the segment — a prefix match would
 * hand every future `/mobile*` route the same blanket pass, above the saas-shared and
 * saas-tenant gates it sits in front of.
 *
 * Pins the APP-SIDE allowlist only. `proxy.ts` carries a deliberate second copy that is
 * module-private and unreachable from here, so it can still regress with this green.
 */
describe('the /mobile allowlist in saas-shared mode', () => {
  afterEach(() => {
    setEnv('NEXT_PUBLIC_APP_MODE', undefined);
  });

  it('exempts the page and anything under it', () => {
    setEnv('NEXT_PUBLIC_APP_MODE', 'saas-shared');
    expect(isRouteAllowedInCurrentMode('/mobile')).toBe(true);
    // `trailingSlash: true` is what the export build actually serves.
    expect(isRouteAllowedInCurrentMode('/mobile/')).toBe(true);
  });

  it('does not exempt a route that merely starts with the same letters', () => {
    setEnv('NEXT_PUBLIC_APP_MODE', 'saas-shared');
    expect(isRouteAllowedInCurrentMode('/mobile-onboarding')).toBe(false);
    expect(isRouteAllowedInCurrentMode('/mobiles')).toBe(false);
  });
});
