/**
 * The desktop setup goes through the `window.posthog` array the GTM PostHog tag adopts as its call
 * queue, so it has to be queued ahead of that tag, and only by the desktop shell.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

const shell = vi.hoisted(() => ({ desktop: false }));

vi.mock('@/lib/platform', () => ({
  isDesktopShell: () => shell.desktop,
}));

import { moveToTenantOrigin } from './desktop-tenant-urls';
import { queueDesktopPostHogSetup } from './posthog-events';

const win = window as unknown as { posthog?: unknown[] };
const SETUP = [
  ['set_config', { before_send: moveToTenantOrigin }],
  ['register', { app_platform: 'desktop' }],
];

afterEach(() => {
  shell.desktop = false;
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
