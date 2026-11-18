/**
 * The desktop setup goes through the `window.posthog` array the GTM PostHog tag adopts as its call
 * queue, so it has to be queued ahead of that tag, and only by the desktop shell.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

const shell = vi.hoisted(() => ({ desktop: false, mobile: false }));

vi.mock('@/lib/platform', () => ({
  isDesktopShell: () => shell.desktop,
  isAppShell: () => shell.desktop || shell.mobile,
}));

import { moveToTenantOrigin } from './desktop-tenant-urls';
import { captureSignInRequiredClick, queueDesktopPostHogSetup, SIGN_IN_REQUIRED_CLICK_EVENT } from './posthog-events';

const win = window as unknown as { posthog?: unknown[] };
const SETUP = [
  ['set_config', { before_send: moveToTenantOrigin }],
  ['register', { app_platform: 'desktop' }],
];

afterEach(() => {
  shell.desktop = false;
  shell.mobile = false;
  delete win.posthog;
});

describe('queueDesktopPostHogSetup', () => {
  it('queues the origin rewrite and the platform tag in the desktop shell', () => {
    shell.desktop = true;
    queueDesktopPostHogSetup();
    expect(win.posthog).toEqual(SETUP);
  });

  it('keeps a queue that already exists', () => {
    shell.desktop = true;
    const queue: unknown[] = [['capture', 'earlier']];
    win.posthog = queue;
    queueDesktopPostHogSetup();
    expect(win.posthog).toBe(queue);
    expect(queue).toEqual([['capture', 'earlier'], ...SETUP]);
  });

  it('leaves window.posthog alone everywhere else', () => {
    queueDesktopPostHogSetup();
    expect(win.posthog).toBeUndefined();
  });
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
