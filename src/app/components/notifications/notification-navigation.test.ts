import type { Notification } from '@flamingo-stack/openframe-frontend-core';
import { beforeEach, describe, expect, it } from 'vitest';
import { useMingoLauncherStore } from '@/app/(app)/mingo/stores/mingo-launcher-store';
import {
  mingoDrawerDialogId,
  resolveNatsNotificationRoute,
  resolveNotificationAction,
  resolvePushNotificationRoute,
} from './notification-navigation';

/**
 * The push payload is a FLAT map; the NATS envelope nests the same fields under
 * `context`. Both feed one mapping, and the push half is the one the backend can
 * truncate — these pin the shape contract rather than the routes themselves.
 */
describe('resolvePushNotificationRoute', () => {
  it('routes a ticket notification from the flat FCM data keys', () => {
    expect(resolvePushNotificationRoute({ type: 'TICKET_ASSIGNED', ticketId: 't-1' })).toBe('/tickets/dialog?id=t-1');
  });

  it('lands a new ticket message on the chat tab', () => {
    expect(resolvePushNotificationRoute({ type: 'CUSTOMER_MESSAGE_PUBLISHED', ticketId: 't-1' })).toBe(
      '/tickets/dialog?id=t-1&tab=chat',
    );
  });

  it('routes an approval request to its ticket', () => {
    const data = { type: 'ADMIN_APPROVAL_REQUEST', ticketId: 't-1', dialogId: 'd-1', approvalRequestId: 'a-1' };
    expect(resolvePushNotificationRoute(data)).toBe('/tickets/dialog?id=t-1');
  });

  it('URL-encodes ids rather than pasting them into the path', () => {
    expect(resolvePushNotificationRoute({ type: 'TICKET_ASSIGNED', ticketId: 'a b&c=1' })).toBe(
      '/tickets/dialog?id=a+b%26c%3D1',
    );
  });

  // buildData drops the serialized context whole once the payload outgrows FCM's
  // budget. Routing must survive that, which is why it reads the flat ids only.
  it('ignores the context blob and routes on the flat ids alone', () => {
    const withContext = {
      type: 'TICKET_ASSIGNED',
      ticketId: 't-1',
      context: JSON.stringify({ type: 'TICKET_ASSIGNED', ticketId: 't-OTHER' }),
    };
    expect(resolvePushNotificationRoute(withContext)).toBe('/tickets/dialog?id=t-1');
    const { context, ...dropped } = withContext;
    expect(resolvePushNotificationRoute(dropped)).toBe('/tickets/dialog?id=t-1');
  });

  it('yields null for an unrecognised type, a missing id, and a junk payload', () => {
    // The caller falls back to the notifications page — an app older than the
    // notification type it was sent must not tap into nothing.
    expect(resolvePushNotificationRoute({ type: 'SOMETHING_SHIPPED_LATER', ticketId: 't-1' })).toBeNull();
    expect(resolvePushNotificationRoute({ type: 'TICKET_ASSIGNED' })).toBeNull();
    expect(resolvePushNotificationRoute({ type: 'TICKET_ASSIGNED', ticketId: '' })).toBeNull();
    expect(resolvePushNotificationRoute(undefined)).toBeNull();
    expect(resolvePushNotificationRoute('not an object')).toBeNull();
  });
});

describe('resolveNatsNotificationRoute', () => {
  it('reads the same fields from the nested envelope', () => {
    expect(resolveNatsNotificationRoute({ context: { type: 'TICKET_ASSIGNED', ticketId: 't-1' } })).toBe(
      '/tickets/dialog?id=t-1',
    );
    expect(resolveNatsNotificationRoute({})).toBeNull();
  });
});

/**
 * A Mingo dialog lives in a drawer that has no route of its own, and these two
 * resolvers run in transports that cannot open it — a push tap and an OS toast,
 * both outside React. They used to answer `null` there and dead-end on the
 * notifications page.
 *
 * They now resolve the drawer's own resting URL rather than the `/mingo` route, so a
 * tap lands on the destination instead of paying for a client-side redirect first.
 *
 * The flag store is deliberately NOT mocked: unloaded is exactly the cold-start
 * state these transports fire in, and the point is that the answer no longer
 * depends on it.
 */
describe('mingo dialog deep links', () => {
  it('routes an admin AI message to the canonical dialog URL', () => {
    expect(resolvePushNotificationRoute({ type: 'ADMIN_AI_MESSAGE', dialogId: 'd-1' })).toBe(
      '/dashboard?mingoDialog=d-1',
    );
    expect(resolveNatsNotificationRoute({ context: { type: 'ADMIN_AI_MESSAGE', dialogId: 'd-1' } })).toBe(
      '/dashboard?mingoDialog=d-1',
    );
  });

  it('routes a dialog-only approval request to the dialog, and a ticket-linked one to its ticket', () => {
    expect(resolvePushNotificationRoute({ type: 'ADMIN_APPROVAL_REQUEST', dialogId: 'd-1' })).toBe(
      '/dashboard?mingoDialog=d-1',
    );
    expect(resolvePushNotificationRoute({ type: 'ADMIN_APPROVAL_REQUEST', dialogId: 'd-1', ticketId: 't-1' })).toBe(
      '/tickets/dialog?id=t-1',
    );
  });
});

/**
 * `mingoDrawerDialogId` is where the drawer-vs-navigate decision moved to, and the
 * whole point of moving it was that it must be answered at CLICK time by the shell
 * rather than at mapping time by a feature flag that has not loaded yet.
 */
describe('mingoDrawerDialogId', () => {
  const mingoAction = () =>
    resolveNotificationAction({
      meta: { contextType: 'ADMIN_AI_MESSAGE', dialogId: 'd-1' },
    } as unknown as Notification);

  beforeEach(() => {
    useMingoLauncherStore.setState({ canOpen: false });
  });

  it('yields the dialog id once the shell reports a drawer', () => {
    useMingoLauncherStore.setState({ canOpen: true });
    expect(mingoDrawerDialogId(mingoAction()!)).toBe('d-1');
  });

  it('yields null with no drawer, so the caller navigates to the canonical route instead', () => {
    // See `MingoLauncherStore.canOpen` for the cases this covers.
    const action = mingoAction();
    expect(mingoDrawerDialogId(action!)).toBeNull();
    expect(action?.route).toBe('/dashboard?mingoDialog=d-1');
  });

  it('yields null for an action that names no dialog, drawer or not', () => {
    useMingoLauncherStore.setState({ canOpen: true });
    const ticket = resolveNotificationAction({
      meta: { contextType: 'TICKET_ASSIGNED', ticketId: 't-1' },
    } as unknown as Notification);
    expect(mingoDrawerDialogId(ticket!)).toBeNull();
  });
});
