import { afterEach, describe, expect, it, vi } from 'vitest';

const shell = vi.hoisted(() => ({ kind: 'web' as 'web' | 'mobile' | 'desktop' }));

vi.mock('./platform', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  isAppShell: () => shell.kind !== 'web',
  isMobileShell: () => shell.kind === 'mobile',
}));

import { isLoginOnlyMobileShell, isMobileAuthLoginOnly } from './app-mode';

/** `window.__ENV` is what next-runtime-env's `env()` reads in the browser. */
function setMobileAuthUi(value: string | undefined) {
  window.__ENV = (value === undefined ? {} : { NEXT_PUBLIC_MOBILE_AUTH_UI: value }) as typeof window.__ENV;
}

/**
 * The switch between the login-only mobile auth screens and the tabbed sign-up flow App Review
 * rejected. The default is the part that matters: a build that forgets the variable must ship the
 * compliant screens.
 */
describe('mobile auth UI switch', () => {
  afterEach(() => {
    setMobileAuthUi(undefined);
    shell.kind = 'web';
  });

  it('is login-only when the variable is unset, empty or unrecognised', () => {
    for (const value of [undefined, '', 'login-only', 'Legacy']) {
      setMobileAuthUi(value);
      expect(isMobileAuthLoginOnly()).toBe(true);
    }
  });

  it('restores the legacy screens only for exactly `legacy`', () => {
    setMobileAuthUi('legacy');
    expect(isMobileAuthLoginOnly()).toBe(false);
  });

  it('applies to the mobile shell only — the web and the desktop shell keep sign-up', () => {
    setMobileAuthUi(undefined);
    shell.kind = 'mobile';
    expect(isLoginOnlyMobileShell()).toBe(true);
    shell.kind = 'desktop';
    expect(isLoginOnlyMobileShell()).toBe(false);
    shell.kind = 'web';
    expect(isLoginOnlyMobileShell()).toBe(false);

    setMobileAuthUi('legacy');
    shell.kind = 'mobile';
    expect(isLoginOnlyMobileShell()).toBe(false);
  });
});
