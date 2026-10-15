import type { Notification } from '@flamingo-stack/openframe-frontend-core';
import { describe, expect, it } from 'vitest';
import { toGlobalId } from '@/lib/relay-id';
import {
  resolveNatsNotificationRoute,
  resolveNotificationAction,
  resolvePushNotificationRoute,
} from './notification-navigation';

/**
 * The push payload is a FLAT map; the NATS envelope carries `type` + `attributes`. Both feed
 * one mapping, and the push half is the one the backend can truncate — these pin the shape
 * contract rather than the routes themselves.
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

  it('routes a ticket-linked approval request to its ticket', () => {
    const data = { type: 'TICKET_APPROVAL_REQUEST', ticketId: 't-1', dialogId: 'd-1', approvalRequestId: 'a-1' };
    expect(resolvePushNotificationRoute(data)).toBe('/tickets/dialog?id=t-1');
  });

  it('URL-encodes ids rather than pasting them into the path', () => {
    expect(resolvePushNotificationRoute({ type: 'TICKET_ASSIGNED', ticketId: 'a b&c=1' })).toBe(
      '/tickets/dialog?id=a+b%26c%3D1',
    );
  });

  // buildData drops any serialized blob whole once the payload outgrows FCM's budget.
  // Routing must survive that, which is why it reads the flat ids only.
  it('ignores a serialized context blob and routes on the flat ids alone', () => {
    const withBlob = {
      type: 'TICKET_ASSIGNED',
      ticketId: 't-1',
      context: JSON.stringify({ type: 'TICKET_ASSIGNED', ticketId: 't-OTHER' }),
    };
    expect(resolvePushNotificationRoute(withBlob)).toBe('/tickets/dialog?id=t-1');
    const { context, ...dropped } = withBlob;
    expect(resolvePushNotificationRoute(dropped)).toBe('/tickets/dialog?id=t-1');
  });

  // The spec contract asks that "an unfamiliar string still routes by ids ... new types will
  // appear without a client release". A ticket id names a ticket whatever the type is called,
  // so an unknown type opens it. Deliberately narrow: only `ticketId` degrades. A bare
  // `dialogId` still yields null unless the category says Mingo — see the unknown-type tests below.
  it('routes an unrecognised type by its ticket id', () => {
    expect(resolvePushNotificationRoute({ type: 'SOMETHING_SHIPPED_LATER', ticketId: 't-1' })).toBe(
      '/tickets/dialog?id=t-1',
    );
  });

  it('yields null for a missing id and a junk payload', () => {
    expect(resolvePushNotificationRoute({ type: 'TICKET_ASSIGNED' })).toBeNull();
    expect(resolvePushNotificationRoute({ type: 'TICKET_ASSIGNED', ticketId: '' })).toBeNull();
    expect(resolvePushNotificationRoute(undefined)).toBeNull();
    expect(resolvePushNotificationRoute('not an object')).toBeNull();
  });
});

describe('resolveNatsNotificationRoute', () => {
  it('reads the ids out of the envelope attributes', () => {
    expect(resolveNatsNotificationRoute({ type: 'TICKET_ASSIGNED', attributes: { ticketId: 't-1' } })).toBe(
      '/tickets/dialog?id=t-1',
    );
    expect(resolveNatsNotificationRoute({})).toBeNull();
  });

  it('ignores a legacy context on the envelope', () => {
    // The typed context is retired; a push that still carries one (or only one) routes on
    // `type` + `attributes` alone rather than on what the context says.
    expect(resolveNatsNotificationRoute({ context: { type: 'TICKET_ASSIGNED', ticketId: 't-1' } })).toBeNull();
    expect(
      resolveNatsNotificationRoute({
        type: 'TICKET_ASSIGNED',
        attributes: { ticketId: 'from-attributes' },
        context: { type: 'TICKET_ASSIGNED', ticketId: 'from-context' },
      }),
    ).toBe('/tickets/dialog?id=from-attributes');
  });
});

/**
 * `insightId` is the STORED id; the incident page's `insight(id:)` takes the Relay global
 * id only, so the route must carry the encoded form — a raw id there fails the page query.
 */
describe('incident deep links', () => {
  const globalId = toGlobalId('Insight', 'i-1');
  const incidentRoute = `/incidents/details?id=${globalId}`;

  it('routes an incident notification to its incident on every transport', () => {
    expect(resolvePushNotificationRoute({ type: 'INCIDENT_DETECTED', insightId: 'i-1' })).toBe(incidentRoute);
    expect(resolveNatsNotificationRoute({ type: 'INCIDENT_DETECTED', attributes: { insightId: 'i-1' } })).toBe(
      incidentRoute,
    );
    const action = resolveNotificationAction({
      meta: { notificationType: 'INCIDENT_DETECTED', insightId: 'i-1' },
    } as unknown as Notification);
    expect(action).toEqual({ label: 'Incident Details', route: incidentRoute });
  });

  it('does not double-encode an id that is already global', () => {
    expect(resolvePushNotificationRoute({ type: 'INCIDENT_DETECTED', insightId: globalId })).toBe(incidentRoute);
  });

  // The transitions announce what someone did to the incident; the incident is still
  // the thing to open.
  it('routes every status transition to the same incident', () => {
    for (const type of ['INCIDENT_ACKNOWLEDGED', 'INCIDENT_SNOOZED', 'INCIDENT_RESOLVED']) {
      expect(resolvePushNotificationRoute({ type, insightId: 'i-1', actor: 'Ann' }), type).toBe(incidentRoute);
      const action = resolveNotificationAction({
        meta: { notificationType: type, insightId: 'i-1', actor: 'Ann' },
      } as unknown as Notification);
      expect(action, type).toEqual({ label: 'Incident Details', route: incidentRoute });
    }
  });

  it('routes an unrecognised type by its insight id, after a ticket id', () => {
    expect(resolvePushNotificationRoute({ type: 'INCIDENT_SHIPPED_LATER', insightId: 'i-1' })).toBe(incidentRoute);
    expect(resolvePushNotificationRoute({ type: 'SOMETHING_ELSE', insightId: 'i-1', ticketId: 't-1' })).toBe(
      '/tickets/dialog?id=t-1',
    );
  });

  it('yields null without an insight id', () => {
    expect(resolvePushNotificationRoute({ type: 'INCIDENT_DETECTED' })).toBeNull();
  });
});

/**
 * A Mingo dialog is opened in-app through the dialog-open seam, but these two resolvers
 * run in transports that cannot reach it — a push tap and an OS toast, both outside
 * React. They used to answer `null` there and dead-end on the notifications page.
 *
 * They resolve the canonical chat link, `/mingo/chat?id=`, which works whichever shell
 * the recipient runs: the Mingo-first shell shows the chat there, the classic shell
 * redirects it to the drawer's resting URL.
 *
 * The flag store is deliberately NOT mocked: unloaded is exactly the cold-start
 * state these transports fire in, and the point is that the answer does not
 * depend on it.
 */
describe('mingo dialog deep links', () => {
  it('routes an admin AI message to the canonical dialog URL', () => {
    expect(resolvePushNotificationRoute({ type: 'ADMIN_AI_MESSAGE', dialogId: 'd-1' })).toBe('/mingo/chat?id=d-1');
    expect(resolveNatsNotificationRoute({ type: 'ADMIN_AI_MESSAGE', attributes: { dialogId: 'd-1' } })).toBe(
      '/mingo/chat?id=d-1',
    );
  });

  it('routes a dialog-only approval request to the dialog, and a ticket-linked one to its ticket', () => {
    expect(resolvePushNotificationRoute({ type: 'MINGO_APPROVAL_REQUEST', dialogId: 'd-1' })).toBe(
      '/mingo/chat?id=d-1',
    );
    expect(resolvePushNotificationRoute({ type: 'TICKET_APPROVAL_REQUEST', dialogId: 'd-1', ticketId: 't-1' })).toBe(
      '/tickets/dialog?id=t-1',
    );
  });

  it('carries the dialog id for the seam beside the route, and only for a dialog', () => {
    const mingo = resolveNotificationAction({
      meta: { notificationType: 'ADMIN_AI_MESSAGE', dialogId: 'd-1' },
    } as unknown as Notification);
    expect(mingo).toEqual({ label: 'Open Chat', route: '/mingo/chat?id=d-1', mingoDialogId: 'd-1' });
    const ticket = resolveNotificationAction({
      meta: { notificationType: 'TICKET_ASSIGNED', ticketId: 't-1' },
    } as unknown as Notification);
    expect(ticket?.mingoDialogId).toBeUndefined();
  });
});

/**
 * The `type` + `attributes` contract on a mapped row: an unfamiliar type must still reach
 * its entity — that promise is the whole point of the flat attribute map.
 */
describe('the type + attributes contract', () => {
  const notification = (meta: Record<string, unknown>, category?: string): Notification =>
    ({ id: 'n-1', title: 'x', createdAt: 0, read: false, category, meta }) as Notification;

  it('routes off the type carried on meta', () => {
    const action = resolveNotificationAction(notification({ notificationType: 'TICKET_ASSIGNED', ticketId: 't-1' }));
    expect(action?.route).toBe('/tickets/dialog?id=t-1');
  });

  it('routes both halves of the approval split by ticket linkage', () => {
    expect(
      resolveNotificationAction(notification({ notificationType: 'TICKET_APPROVAL_REQUEST', ticketId: 't-3' }))?.route,
    ).toBe('/tickets/dialog?id=t-3');
    expect(
      resolveNotificationAction(notification({ notificationType: 'MINGO_APPROVAL_REQUEST', dialogId: 'd-1' }))
        ?.mingoDialogId,
    ).toBe('d-1');
  });

  it('reads ids out of attributes on a NATS envelope', () => {
    const route = resolveNatsNotificationRoute({
      type: 'TICKET_STATUS_CHANGED',
      attributes: { ticketId: 't-4', newStatusLabel: 'Closed' },
      category: 'TICKETS',
    });
    expect(route).toBe('/tickets/dialog?id=t-4');
  });

  it("opens an unknown type's bare dialog only when the category says Mingo", () => {
    expect(
      resolveNotificationAction(notification({ notificationType: 'SOME_NEW_MINGO', dialogId: 'd-2' }, 'MINGO'))
        ?.mingoDialogId,
    ).toBe('d-2');
    // A CLIENT chat's dialogId: the Mingo drawer resolves admin dialogs only, so following
    // this would land on an empty chat.
    expect(
      resolveNotificationAction(notification({ notificationType: 'SOME_NEW_CLIENT', dialogId: 'd-3' }, 'TICKETS')),
    ).toBeNull();
  });
});

/**
 * The re-consent notice names no entity: on every transport it opens the tenant list, where
 * each connection re-authorizes.
 */
describe('re-consent notice', () => {
  it('routes NEW_PERMISSIONS_REQUIRED to the tenant list', () => {
    expect(
      resolvePushNotificationRoute({ type: 'NEW_PERMISSIONS_REQUIRED', providers: 'MICROSOFT_365,GOOGLE_WORKSPACE' }),
    ).toBe('/cloud-tenant-management');
    expect(
      resolveNatsNotificationRoute({
        type: 'NEW_PERMISSIONS_REQUIRED',
        attributes: { providers: 'MICROSOFT_365' },
        category: 'GENERIC',
      }),
    ).toBe('/cloud-tenant-management');
    const action = resolveNotificationAction({
      meta: { notificationType: 'NEW_PERMISSIONS_REQUIRED', providers: 'MICROSOFT_365' },
    } as unknown as Notification);
    expect(action).toEqual({ label: 'Cloud Tenants', route: '/cloud-tenant-management' });
  });
});
