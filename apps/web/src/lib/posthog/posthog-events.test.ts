import { afterEach, describe, expect, it, vi } from 'vitest';

const shell = vi.hoisted(() => ({ desktop: false, mobile: false }));

vi.mock('@/lib/platform', () => ({
  isAppShell: () => shell.desktop || shell.mobile,
}));

import { captureSignInRequiredClick, SIGN_IN_REQUIRED_CLICK_EVENT } from './posthog-events';

const win = window as unknown as { posthog?: unknown };

afterEach(() => {
  shell.desktop = false;
  shell.mobile = false;
  delete win.posthog;
});

describe('captureSignInRequiredClick', () => {
  const CLICK = {
    app_mode: 'saas-tenant',
    shell: 'web',
    target_url: 'https://qa.openframe.build/auth/login/',
    fallback: false,
  };
  const sdk = window as unknown as { posthog?: unknown };

  it('captures on the loaded SDK with a beacon, so it survives the navigation', () => {
    const capture = vi.fn();
    sdk.posthog = { capture };
    captureSignInRequiredClick(CLICK);
    expect(capture).toHaveBeenCalledWith(SIGN_IN_REQUIRED_CLICK_EVENT, CLICK, { transport: 'sendBeacon' });
  });

  it('does nothing while PostHog is missing or still a call queue', () => {
    expect(() => captureSignInRequiredClick(CLICK)).not.toThrow();
    const queue: unknown[] = [];
    sdk.posthog = queue;
    expect(() => captureSignInRequiredClick(CLICK)).not.toThrow();
    expect(queue).toEqual([]);
  });

  it('never throws into sign-in when the SDK does', () => {
    sdk.posthog = {
      capture: () => {
        throw new Error('sdk');
      },
    };
    expect(() => captureSignInRequiredClick(CLICK)).not.toThrow();
  });

  it.each(['desktop', 'mobile'] as const)('does not capture in the %s shell', kind => {
    shell[kind] = true;
    const capture = vi.fn();
    sdk.posthog = { capture };
    captureSignInRequiredClick(CLICK);
    expect(capture).not.toHaveBeenCalled();
  });
});
