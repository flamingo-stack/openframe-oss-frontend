import type { Notification } from '@flamingo-stack/openframe-frontend-core';
import { describe, expect, it, vi } from 'vitest';

// See notifications-contract.test.ts — the relay babel transform doesn't run under vitest.
vi.mock('react-relay', async importOriginal => ({
  ...(await importOriginal<typeof import('react-relay')>()),
  graphql: () => ({}),
}));

import {
  resolveNativePushRoute,
  resolveNatsNotificationRoute,
  resolveNotificationAction,
} from './notification-navigation';

/**
 * Routing must survive the backend adding notification types without a client release —
 * the contract says unknown types degrade by entity id rather than losing their action.
 */

function notification(meta: Record<string, unknown>, category?: string): Notification {
  return { id: 'n-1', title: 'x', createdAt: 0, read: false, category, meta } as Notification;
}

describe('known types', () => {
  it('routes a ticket type to the ticket dialog', () => {
    const action = resolveNotificationAction(notification({ notificationType: 'TICKET_ASSIGNED', ticketId: 't-1' }));
    expect(action).toEqual({ label: 'Ticket Details', route: '/tickets/dialog?id=t-1' });
  });

  it('lands client-chat message types on the chat tab', () => {
    const action = resolveNotificationAction(
      notification({ notificationType: 'CUSTOMER_MESSAGE_PUBLISHED', ticketId: 't-1' }),
    );
    expect(action).toEqual({ label: 'Ticket Details', route: '/tickets/dialog?id=t-1&tab=chat' });
  });

  it('routes both spec approval types by ticket linkage', () => {
    expect(
      resolveNotificationAction(notification({ notificationType: 'TICKET_APPROVAL_REQUEST', ticketId: 't-2' })),
    ).toEqual({ label: 'Ticket Details', route: '/tickets/dialog?id=t-2' });

    const mingo = resolveNotificationAction(
      notification({ notificationType: 'MINGO_APPROVAL_REQUEST', dialogId: 'd-1' }, 'MINGO'),
    );
    expect(mingo?.label).toBe('Open Chat');
  });

  it('still routes a legacy row that only has contextType', () => {
    const action = resolveNotificationAction(notification({ contextType: 'TICKET_REOPENED', ticketId: 't-3' }));
    expect(action).toEqual({ label: 'Ticket Details', route: '/tickets/dialog?id=t-3' });
  });
});

describe('types this release has never heard of', () => {
  it('routes to the ticket when the payload carries a ticket id', () => {
    const action = resolveNotificationAction(
      notification({ notificationType: 'TICKET_SLA_BREACHED', ticketId: 't-9' }, 'TICKETS'),
    );
    expect(action).toEqual({ label: 'Ticket Details', route: '/tickets/dialog?id=t-9' });
  });

  it('opens a bare dialog only when the category says it is a Mingo one', () => {
    const mingo = resolveNotificationAction(
      notification({ notificationType: 'SOME_NEW_MINGO', dialogId: 'd-2' }, 'MINGO'),
    );
    expect(mingo?.label).toBe('Open Chat');

    // A client-chat dialog id the admin drawer cannot open must not become an action.
    const clientSide = resolveNotificationAction(
      notification({ notificationType: 'SOME_NEW_CLIENT', dialogId: 'd-3' }, 'TICKETS'),
    );
    expect(clientSide).toBeNull();
  });

  it('offers no action when there is no entity id at all', () => {
    expect(resolveNotificationAction(notification({ notificationType: 'SOMETHING_ELSE' }))).toBeNull();
  });
});

describe('raw NATS envelopes (native shell OS-toast click)', () => {
  it('reads the spec shape', () => {
    const route = resolveNatsNotificationRoute({
      type: 'TICKET_STATUS_CHANGED',
      attributes: { ticketId: 't-4', newStatusLabel: 'Closed' },
      category: 'TICKETS',
    });
    expect(route).toBe('/tickets/dialog?id=t-4');
  });

  it('still reads a legacy envelope that only forwards context', () => {
    const route = resolveNatsNotificationRoute({
      context: { type: 'TICKET_STATUS_CHANGED', ticketId: 't-5' },
    });
    expect(route).toBe('/tickets/dialog?id=t-5');
  });

  it('degrades an unknown type by ticket id', () => {
    const route = resolveNatsNotificationRoute({ type: 'BRAND_NEW', attributes: { ticketId: 't-6' } });
    expect(route).toBe('/tickets/dialog?id=t-6');
  });

  it('returns null for an envelope with nothing to open', () => {
    expect(resolveNatsNotificationRoute({})).toBeNull();
    expect(resolveNatsNotificationRoute(null)).toBeNull();
  });
});

describe('mobile FCM push payloads', () => {
  it('routes off the flat keys the backend sends', () => {
    const route = resolveNativePushRoute({
      notificationId: 'n-1',
      type: 'TICKET_ASSIGNED',
      category: 'TICKETS',
      severity: 'INFO',
      ticketId: 't-1',
    });
    expect(route).toBe('/tickets/dialog?id=t-1');
  });

  it('still routes when the context blob was dropped for size', () => {
    // The whole point of the flat keys: an oversized context is dropped, ids survive.
    const route = resolveNativePushRoute({ type: 'MINGO_APPROVAL_REQUEST', dialogId: 'd-1', category: 'MINGO' });
    expect(route).toBe('/mingo?dialogId=d-1');
  });

  it('falls back to the serialized context blob', () => {
    const route = resolveNativePushRoute({
      context: JSON.stringify({ type: 'TICKET_REOPENED', ticketId: 't-2' }),
    });
    expect(route).toBe('/tickets/dialog?id=t-2');
  });

  it('survives a malformed context blob', () => {
    expect(resolveNativePushRoute({ context: 'not json' })).toBeNull();
  });

  it('degrades an unknown type by ticket id', () => {
    expect(resolveNativePushRoute({ type: 'BRAND_NEW', ticketId: 't-3' })).toBe('/tickets/dialog?id=t-3');
  });

  it('returns null for a payload with nothing openable', () => {
    expect(resolveNativePushRoute({ type: 'TICKET_ASSIGNED' })).toBeNull();
    expect(resolveNativePushRoute(undefined)).toBeNull();
  });
});
