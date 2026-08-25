import { describe, expect, it } from 'vitest';
import { resolveNatsNotificationRoute, resolvePushNotificationRoute } from './notification-navigation';

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
