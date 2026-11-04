import type { Notification } from '@flamingo-stack/openframe-frontend-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toGlobalId } from '@/lib/relay-id';
import {
  followNotificationTap,
  notificationTargetsLocation,
  resolveNatsNotificationAction,
  resolveNotificationAction,
  resolvePushNotificationAction,
} from './notification-navigation';

// The tenant host is what tells a link into the app from one out of it. Unset, the page's own
// origin stands in, and jsdom's is plain http, which no announcement link can match.
const tenant = vi.hoisted(() => ({ host: '' }));
vi.mock('@/lib/runtime-config', () => ({ runtimeEnv: { tenantHostUrl: () => tenant.host } }));

/** The route each transport's tap would push; these tests pin the routes, not the action shape. */
const resolvePushNotificationRoute = (data: unknown) => resolvePushNotificationAction(data)?.route ?? null;
const resolveNatsNotificationRoute = (payload: unknown) => resolveNatsNotificationAction(payload)?.route ?? null;

/**
 * The push payload is a FLAT map; the NATS envelope carries `type` + `attributes`. Both feed
 * one mapping, and the push half is the one the backend can truncate — these pin the shape
 * contract rather than the routes themselves.
 */
describe('resolvePushNotificationAction', () => {
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

describe('resolveNatsNotificationAction', () => {
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

  it('routes AUTO_TOP_UP_PAUSED to the billing page', () => {
    expect(resolvePushNotificationRoute({ type: 'AUTO_TOP_UP_PAUSED', resumesAt: '2026-11-04T10:00:00Z' })).toBe(
      '/settings/billing-usage',
    );
    expect(
      resolveNatsNotificationRoute({
        type: 'AUTO_TOP_UP_PAUSED',
        attributes: { resumesAt: '2026-11-04T10:00:00Z' },
        category: 'GENERIC',
      }),
    ).toBe('/settings/billing-usage');
    const action = resolveNotificationAction({
      meta: { notificationType: 'AUTO_TOP_UP_PAUSED' },
    } as unknown as Notification);
    expect(action).toEqual({ label: 'Billing & Usage', route: '/settings/billing-usage' });
  });
});

/**
 * The Remote Sessions recording cards: one about a recording opens it, a session that left no
 * recording opens its device's sessions, and the tenant's storage opens every device's sessions.
 */
describe('remote session recording cards', () => {
  const RECORDING = '/devices/details/remote-session?id=rec-1';
  const DEVICE_SESSIONS = '/devices/details?id=machine-1&tab=remote-sessions';
  const ids = { sessionId: 's-1', recordingId: 'rec-1', deviceId: 'machine-1', deviceName: 'DESKTOP-4F2K' };
  const card = (meta: Record<string, unknown>) =>
    ({ id: 'n-1', title: 'x', createdAt: 0, read: false, category: 'DEVICES', meta }) as Notification;

  it('opens the recording from every transport', () => {
    for (const type of [
      'RECORDING_EXPIRES_IN_7_DAYS',
      'RECORDING_ABOUT_TO_BE_DELETED',
      'KEEP_RELEASED_BY_SOMEONE_ELSE',
    ]) {
      expect(resolveNotificationAction(card({ notificationType: type, ...ids }))).toEqual({
        label: 'Open Recording',
        route: RECORDING,
      });
      expect(resolveNatsNotificationRoute({ type, attributes: ids, category: 'DEVICES' })).toBe(RECORDING);
      expect(resolvePushNotificationRoute({ type, ...ids })).toBe(RECORDING);
    }
  });

  it("falls back to the device's sessions without a recording id, and to nothing without either", () => {
    expect(
      resolvePushNotificationRoute({ type: 'RECORDING_EXPIRES_IN_7_DAYS', sessionId: 's-1', deviceId: 'machine-1' }),
    ).toBe(DEVICE_SESSIONS);
    expect(resolvePushNotificationRoute({ type: 'RECORDING_EXPIRES_IN_7_DAYS', sessionId: 's-1' })).toBeNull();
  });

  it("opens the device's sessions for a session that left no recording", () => {
    const failed = { type: 'RECORDING_FAILED', sessionId: 's-1', deviceId: 'machine-1' };
    expect(resolvePushNotificationRoute(failed)).toBe(DEVICE_SESSIONS);
    expect(resolveNotificationAction(card({ notificationType: 'RECORDING_FAILED', deviceId: 'machine-1' }))).toEqual({
      label: 'Remote Sessions',
      route: DEVICE_SESSIONS,
    });
    expect(resolvePushNotificationRoute({ type: 'RECORDING_FAILED', sessionId: 's-1' })).toBeNull();
  });

  it("opens every device's sessions for the tenant's storage", () => {
    for (const type of ['RECORDING_STORAGE_NEARLY_FULL', 'RECORDING_STORAGE_FULL']) {
      expect(
        resolveNatsNotificationRoute({ type, attributes: { usedBytes: '1', limitBytes: '2' }, category: 'DEVICES' }),
      ).toBe('/devices/remote-sessions');
    }
  });

  it('routes an unrecognised type by its recording id', () => {
    expect(resolvePushNotificationRoute({ type: 'RECORDING_SOMETHING_NEW', recordingId: 'rec-1' })).toBe(RECORDING);
  });

  it('reads as opened once the recording it points at is on screen', () => {
    const notification = card({ notificationType: 'KEEP_RELEASED_BY_SOMEONE_ELSE', ...ids });
    expect(
      notificationTargetsLocation(notification, '/devices/details/remote-session', new URLSearchParams('id=rec-1')),
    ).toBe(true);
    expect(
      notificationTargetsLocation(notification, '/devices/details/remote-session', new URLSearchParams('id=rec-2')),
    ).toBe(false);
  });
});

/**
 * An announcement names no entity, so its link is the one destination a payload names.
 * Inside the app it navigates; anywhere else it opens outside the app and is never routed.
 */
describe('announcement links', () => {
  const LINK = 'https://www.flamingo.run/releases/v1-5-81?utm_source=openframe#notes';
  const OUTSIDE = { label: 'Open Link', externalUrl: LINK };
  const announcement = (meta: Record<string, unknown>) =>
    ({
      id: 'n-1',
      title: 'x',
      createdAt: 0,
      read: false,
      category: 'GENERIC',
      meta: { notificationType: 'ANNOUNCEMENT', ...meta },
    }) as Notification;

  afterEach(() => {
    tenant.host = '';
  });

  it('opens a link outside the app from every transport', () => {
    expect(resolveNotificationAction(announcement({ link: LINK }))).toEqual(OUTSIDE);
    expect(
      resolveNatsNotificationAction({ type: 'ANNOUNCEMENT', attributes: { link: LINK }, category: 'GENERIC' }),
    ).toEqual(OUTSIDE);
    expect(resolvePushNotificationAction({ type: 'ANNOUNCEMENT', link: LINK })).toEqual(OUTSIDE);
  });

  it("navigates inside the app for a link on the tenant's own origin, and only its own", () => {
    tenant.host = 'https://acme.openframe.ai';
    expect(
      resolveNotificationAction(announcement({ link: 'https://acme.openframe.ai/devices/details?id=m-1#hardware' })),
    ).toEqual({ label: 'Open Link', route: '/devices/details?id=m-1#hardware', readOnOpen: true });
    for (const elsewhere of ['https://other.openframe.ai/devices', 'https://acme.openframe.ai:8443/devices']) {
      expect(resolvePushNotificationAction({ type: 'ANNOUNCEMENT', link: elsewhere }), elsewhere).toEqual({
        label: 'Open Link',
        externalUrl: elsewhere,
      });
    }
  });

  // The router reads a path starting `//` as protocol-relative: pushed, it would take the
  // app's own window to another host. URL folds backslashes and dot segments into the path.
  it('opens a path the router would read as another host outside the app instead', () => {
    tenant.host = 'https://acme.openframe.ai';
    for (const link of [
      'https://acme.openframe.ai//evil.example/x',
      'https://acme.openframe.ai/\\evil.example/x',
      'https://acme.openframe.ai/./..//evil.example/x',
    ]) {
      const action = resolvePushNotificationAction({ type: 'ANNOUNCEMENT', link });
      expect(action?.route, link).toBeUndefined();
      expect(action?.externalUrl, link).toBe('https://acme.openframe.ai//evil.example/x');
    }
  });

  it('opens nothing for a link that is not an absolute https URL, or for no link', () => {
    for (const link of [
      'http://www.flamingo.run/',
      'javascript:alert(1)',
      'data:text/html,hi',
      '/devices',
      'not a url',
    ]) {
      expect(resolvePushNotificationAction({ type: 'ANNOUNCEMENT', link }), link).toBeNull();
      expect(resolveNotificationAction(announcement({ link })), link).toBeNull();
    }
    expect(resolveNotificationAction(announcement({}))).toBeNull();
    expect(resolvePushNotificationAction({ type: 'ANNOUNCEMENT', link: '' })).toBeNull();
  });

  it('is followed on an announcement only', () => {
    expect(resolvePushNotificationRoute({ type: 'TICKET_ASSIGNED', ticketId: 't-1', link: LINK })).toBe(
      '/tickets/dialog?id=t-1',
    );
    expect(resolvePushNotificationAction({ type: 'SOMETHING_SHIPPED_LATER', link: LINK })).toBeNull();
  });

  // Its page is the backoffice's pick, not the announcement's entity: an admin already on
  // the dashboard has not read an announcement that links the dashboard. Opening it reads it.
  it('is never read by arriving at a page, even the one in the app it links', () => {
    expect(notificationTargetsLocation(announcement({ link: LINK }), '/releases/v1-5-81', new URLSearchParams())).toBe(
      false,
    );
    tenant.host = 'https://acme.openframe.ai';
    expect(
      notificationTargetsLocation(
        announcement({ link: 'https://acme.openframe.ai/devices' }),
        '/devices',
        new URLSearchParams(),
      ),
    ).toBe(false);
  });
});

/** What a push tap or an OS banner click does with the action it resolved. */
describe('followNotificationTap', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens a link outside the app and pushes nothing', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const navigate = vi.fn();
    followNotificationTap({ label: 'Open Link', externalUrl: 'https://www.flamingo.run/' }, navigate);
    expect(open).toHaveBeenCalledWith('https://www.flamingo.run/', '_blank', 'noopener,noreferrer');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('pushes a route, and the notifications page when there is nothing to open', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const navigate = vi.fn();
    followNotificationTap({ label: 'Ticket Details', route: '/tickets/dialog?id=t-1' }, navigate);
    followNotificationTap(null, navigate);
    expect(navigate.mock.calls).toEqual([['/tickets/dialog?id=t-1'], ['/notifications']]);
    expect(open).not.toHaveBeenCalled();
  });
});
