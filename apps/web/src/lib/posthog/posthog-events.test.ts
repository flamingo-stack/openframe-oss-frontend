/**
 * The desktop tag goes through the `window.posthog` array the GTM PostHog tag adopts as its call
 * queue, so it has to be queued ahead of that tag, and only by the desktop shell.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

const shell = vi.hoisted(() => ({ desktop: false }));

vi.mock('@/lib/platform', () => ({
  isDesktopShell: () => shell.desktop,
}));

import { queueDesktopSuperProperties } from './posthog-events';

const win = window as unknown as { posthog?: unknown[] };

afterEach(() => {
  shell.desktop = false;
  delete win.posthog;
});

describe('queueDesktopSuperProperties', () => {
  it('queues the platform tag in the desktop shell', () => {
    shell.desktop = true;
    queueDesktopSuperProperties();
    expect(win.posthog).toEqual([['register', { app_platform: 'desktop' }]]);
  });

  it('keeps a queue that already exists', () => {
    shell.desktop = true;
    const queue: unknown[] = [['capture', 'earlier']];
    win.posthog = queue;
    queueDesktopSuperProperties();
    expect(win.posthog).toBe(queue);
    expect(queue).toEqual([
      ['capture', 'earlier'],
      ['register', { app_platform: 'desktop' }],
    ]);
  });

  it('leaves window.posthog alone everywhere else', () => {
    queueDesktopSuperProperties();
    expect(win.posthog).toBeUndefined();
  });
});
