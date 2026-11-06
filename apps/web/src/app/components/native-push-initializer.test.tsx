/**
 * The mobile shell's push tap: the FCM data map goes through the same mapping as the drawer.
 * An announcement's link opens in the shell's in-app browser, or inside the app on the
 * tenant's origin, and is read by the tap; any other tap is a route, read where it lands.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  push: vi.fn<(route: string) => void>(),
  markRead: vi.fn<(id: string) => void>(),
  tap: null as ((data: Record<string, unknown> | undefined) => void) | null,
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: h.push }) }));
vi.mock('@/graphql/notifications/mark-notification-read-mutation', () => ({
  markNotificationReadById: h.markRead,
}));
vi.mock('@/lib/platform', () => ({ isMobileShell: () => true }));
vi.mock('@/lib/runtime-config', () => ({ runtimeEnv: { tenantHostUrl: () => 'https://acme.openframe.ai' } }));
vi.mock('./subscription-lock/subscription-guard', () => ({ useSubscriptionOpen: () => true }));
vi.mock('@/lib/native-push', () => ({
  initNativePush: (onTap: (data: Record<string, unknown> | undefined) => void) => {
    h.tap = onTap;
    return Promise.resolve();
  },
}));

import { NativePushInitializer } from './native-push-initializer';

let root: Root;
let container: HTMLElement;

beforeEach(async () => {
  h.push.mockReset();
  h.markRead.mockReset();
  h.tap = null;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<NativePushInitializer />));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe('a push tap', () => {
  it("opens an announcement's link outside the app from the flat data keys, and reads it", () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const data = { type: 'ANNOUNCEMENT', notificationId: 'n-1', link: 'https://www.flamingo.run/releases/v1-5-81' };

    h.tap?.(data);

    expect(open).toHaveBeenCalledWith('https://www.flamingo.run/releases/v1-5-81', '_blank', 'noopener,noreferrer');
    expect(h.push).not.toHaveBeenCalled();
    expect(h.markRead.mock.calls).toEqual([['n-1']]);
  });

  it('navigates inside the app for a link on its own origin, a route, or the notifications page', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);

    h.tap?.({ type: 'ANNOUNCEMENT', notificationId: 'n-2', link: 'https://acme.openframe.ai/devices' });
    h.tap?.({ type: 'TICKET_ASSIGNED', notificationId: 'n-3', ticketId: 't-1' });
    h.tap?.({ type: 'ANNOUNCEMENT', notificationId: 'n-4' });
    h.tap?.(undefined);

    expect(h.push.mock.calls).toEqual([
      ['/devices'],
      ['/tickets/dialog?id=t-1'],
      ['/notifications'],
      ['/notifications'],
    ]);
    expect(open).not.toHaveBeenCalled();
    // Only the announcement with a link is read by the tap: the ticket is read where it lands, and
    // an announcement without one opens nothing.
    expect(h.markRead.mock.calls).toEqual([['n-2']]);
  });
});
