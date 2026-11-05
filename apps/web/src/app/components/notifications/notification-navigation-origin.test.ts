// @vitest-environment-options { "url": "https://acme.openframe.ai/mingo" }

/**
 * The web app is served by its tenant, so with no tenant host configured the page's own
 * origin is the app's: a link there still opens inside the app. jsdom's origin cannot be
 * changed inside a test, hence a file of its own.
 */

import { describe, expect, it, vi } from 'vitest';
import { resolvePushNotificationAction } from './notification-navigation';

vi.mock('@/lib/runtime-config', () => ({ runtimeEnv: { tenantHostUrl: () => '' } }));

describe("a link on the page's own origin with no tenant host configured", () => {
  it('navigates inside the app', () => {
    expect(window.location.origin).toBe('https://acme.openframe.ai');
    expect(resolvePushNotificationAction({ type: 'ANNOUNCEMENT', link: 'https://acme.openframe.ai/devices' })).toEqual({
      label: 'Open Link',
      route: '/devices',
      readOnOpen: true,
    });
  });
});
