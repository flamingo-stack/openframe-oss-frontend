import type { Notification } from '@flamingo-stack/openframe-frontend-core';
import {
  INCIDENT_DETECTED_TYPE,
  isApprovalNotificationType,
  isIncidentNotificationType,
  isRecordingNotificationType,
  isRecordingStorageNotificationType,
  NEW_PERMISSIONS_REQUIRED_TYPE,
  NOTIFICATION_ATTR,
  RECORDING_NOTIFICATION_TYPES,
  readNotificationAttributes,
} from '@/graphql/notifications/notification-attributes';
import { ensureGlobalIdForType } from '@/lib/relay-id';
import { mingoDialogLink, routes } from '@/lib/routes';
import { runtimeEnv } from '@/lib/runtime-config';

// Backend notification `type` discriminators (`TenantNotificationType`). GraphQL rows and NATS
// payloads carry the same string, so it is the single source of truth for routing.
export const ADMIN_AI_MESSAGE_TYPE = 'ADMIN_AI_MESSAGE';
export const ADMIN_AI_TICKET_MESSAGE_TYPE = 'ADMIN_AI_TICKET_MESSAGE';
export const CLIENT_AI_MESSAGE_TYPE = 'CLIENT_AI_MESSAGE';
export const TICKET_STATUS_CHANGED_TYPE = 'TICKET_STATUS_CHANGED';
// A reopen transition REPLACES the generic status-change notification server-side —
// without this mapping reopens would be invisible (no navigation, no auto-read).
export const TICKET_REOPENED_TYPE = 'TICKET_REOPENED';
export const TICKET_ASSIGNED_TYPE = 'TICKET_ASSIGNED';
export const TICKET_ESCALATED_BY_USER_TYPE = 'TICKET_ESCALATED_BY_USER';
export const CUSTOMER_MESSAGE_PUBLISHED_TYPE = 'CUSTOMER_MESSAGE_PUBLISHED';
export const ADMIN_MESSAGE_PUBLISHED_TYPE = 'ADMIN_MESSAGE_PUBLISHED';
// The spend limit paused auto top-up; names no entity, only the owner's billing page.
export const AUTO_TOP_UP_PAUSED_TYPE = 'AUTO_TOP_UP_PAUSED';
// Sent from the backoffice to every admin; names no entity, and opens its `link` when it has one.
export const ANNOUNCEMENT_TYPE = 'ANNOUNCEMENT';
// The incident family (the detection and its status transitions) is declared with the
// attribute contract, Relay-free, because the mapper reads it too.
export { INCIDENT_DETECTED_TYPE };

/**
 * Types whose entity is a ticket; they navigate to the ticket dialog via `ticketId`.
 * CLIENT_AI_MESSAGE belongs here only when its dialog is ticket-linked — a Fae chat can run
 * without a ticket, and without one the notification resolves to no action.
 */
const TICKET_TYPES = new Set<string>([
  ADMIN_AI_TICKET_MESSAGE_TYPE,
  TICKET_STATUS_CHANGED_TYPE,
  TICKET_REOPENED_TYPE,
  TICKET_ASSIGNED_TYPE,
  TICKET_ESCALATED_BY_USER_TYPE,
  CUSTOMER_MESSAGE_PUBLISHED_TYPE,
  ADMIN_MESSAGE_PUBLISHED_TYPE,
  CLIENT_AI_MESSAGE_TYPE,
]);

/**
 * Ticket types announcing a new message in the ticket's client chat; they land on the
 * Chat tab instead of Details. Mingo ticket messages (`ADMIN_AI_TICKET_MESSAGE`) are
 * excluded — that conversation is a Mingo chat, not the page's Client Chat tab.
 */
const TICKET_CHAT_TYPES = new Set<string>([
  CUSTOMER_MESSAGE_PUBLISHED_TYPE,
  ADMIN_MESSAGE_PUBLISHED_TYPE,
  CLIENT_AI_MESSAGE_TYPE,
]);

/**
 * A notification's primary action. An action inside the app has a `route` — a URL the
 * host can push, and the only thing a transport that runs OUTSIDE React (a push tap, an
 * OS toast) can act on.
 *
 * A Mingo dialog additionally carries `mingoDialogId`, for a caller that opens it
 * through the dialog-open seam (`openMingoDialog` in `./open-mingo-dialog`). Its
 * `route` is the canonical chat link.
 *
 * `readOnOpen` marks a route that is not the notification's entity (an announcement's
 * link into the app): arriving there must not read it, and opening it must.
 */
export type NotificationRouteAction = {
  label: string;
  route: string;
  mingoDialogId?: string;
  readOnOpen?: true;
  externalUrl?: never;
};

/**
 * An announcement's link to a page outside the app. It has no `route`: pushed through the
 * router, an absolute URL would navigate the app's own window away, which in a shell is the
 * whole app. Opened with {@link openNotificationLink} instead.
 */
export type NotificationLinkAction = {
  label: string;
  externalUrl: string;
  route?: never;
  mingoDialogId?: never;
  readOnOpen?: never;
};

export type NotificationAction = NotificationLinkAction | NotificationRouteAction;

export function isNotificationLinkAction(action: NotificationAction): action is NotificationLinkAction {
  return action.externalUrl !== undefined;
}

// routes.* builders URL-encode values via URLSearchParams — no manual encodeURIComponent.
const mingoDialogRoute = (dialogId: string) => mingoDialogLink(dialogId);
const ticketRoute = (ticketId: string, tab?: 'chat') => routes.tickets.dialog(ticketId, { tab });
// The attribute carries the STORED insight id; the details page queries `insight(id:)`, which
// takes the Relay global id only (saas-api `InsightNodeIdCodec` rejects anything else).
const incidentAction = (insightId: string): NotificationAction => ({
  label: 'Incident Details',
  route: routes.incidents.details(ensureGlobalIdForType('Insight', insightId)),
});
const recordingAction = (recordingId: string): NotificationAction => ({
  label: 'Open Recording',
  route: routes.devices.remoteSessionRecording(recordingId),
});
const deviceRemoteSessionsAction = (deviceId: string): NotificationAction => ({
  label: 'Remote Sessions',
  route: routes.devices.details(deviceId, { tab: 'remote-sessions' }),
});

/** Action for a Mingo dialog: the canonical chat link, plus the dialog id. */
const mingoDialogAction = (dialogId: string): NotificationAction => ({
  label: 'Open Chat',
  route: mingoDialogRoute(dialogId),
  mingoDialogId: dialogId,
});

const nonEmptyString = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);

/** Backend `NotificationCategory` for Mingo — the signal that an unknown type's dialog is an admin one. */
const MINGO_CATEGORY = 'MINGO';

/** The app's own origin: the tenant host, which in a shell is not the page's origin. */
function appOrigin(): string | null {
  const host = runtimeEnv.tenantHostUrl() || (typeof window === 'undefined' ? '' : window.location.origin);
  if (!host) return null;
  try {
    return new URL(host).origin;
  } catch {
    return null;
  }
}

/**
 * An announcement's link: a page on the app's own origin opens inside the app, any other
 * outside it.
 *
 * This is the one destination a payload names rather than one built from its ids, so it is
 * checked again here although management-api accepts absolute https URLs only: a forged or
 * mangled payload must not open a `javascript:` or plain-http page.
 */
function linkAction(link: string): NotificationAction | null {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  const label = 'Open Link';
  // The path of an absolute URL on our origin, not a hand-written one: the registry has no
  // builder for a page the backoffice picked. A path starting `//` (backslashes and dot
  // segments are already folded into it) would be protocol-relative to the router, which
  // would take the app's window to another host, so that link opens outside the app.
  if (url.origin === appOrigin() && !url.pathname.startsWith('//')) {
    return { label, route: `${url.pathname}${url.search}${url.hash}`, readOnOpen: true };
  }
  return { label, externalUrl: url.href };
}

/** The entity ids, and an announcement's link, a notification can carry, read from `attributes` (or the flat push keys). */
interface NotificationIds {
  ticketId: string | null;
  dialogId: string | null;
  insightId: string | null;
  recordingId: string | null;
  deviceId: string | null;
  link: string | null;
}

function resolveAction(
  type: string | null,
  { ticketId, dialogId, insightId, recordingId, deviceId, link }: NotificationIds,
  category: string | null,
): NotificationAction | null {
  // Approval requests live in their ticket when one exists, otherwise the mingo dialog.
  if (isApprovalNotificationType(type)) {
    if (ticketId) return { label: 'Ticket Details', route: ticketRoute(ticketId) };
    if (dialogId) return mingoDialogAction(dialogId);
    return null;
  }

  if (type && TICKET_TYPES.has(type) && ticketId) {
    const tab = TICKET_CHAT_TYPES.has(type) ? 'chat' : undefined;
    return { label: 'Ticket Details', route: ticketRoute(ticketId, tab) };
  }

  if (type === ADMIN_AI_MESSAGE_TYPE && dialogId) {
    return mingoDialogAction(dialogId);
  }

  // Detection and every status transition (acknowledged, snoozed, resolved) name the same
  // incident, so they all open it.
  if (isIncidentNotificationType(type) && insightId) {
    return incidentAction(insightId);
  }

  // Names no entity: the tenant list is where each connection re-authorizes.
  if (type === NEW_PERMISSIONS_REQUIRED_TYPE) {
    return { label: 'Cloud Tenants', route: routes.cloudTenantManagement.list };
  }

  // The limit is raised (or the pause read) where the arrangement is shown.
  if (type === AUTO_TOP_UP_PAUSED_TYPE) {
    return { label: 'Billing & Usage', route: routes.settings.billingUsage() };
  }

  // A recording about to expire, about to be deleted, or released by someone else opens the
  // recording; without its id, the device's sessions are the nearest place to find it.
  if (isRecordingNotificationType(type)) {
    if (recordingId) return recordingAction(recordingId);
    if (deviceId) return deviceRemoteSessionsAction(deviceId);
    return null;
  }

  // No file arrived, so there is no recording to open: the device's sessions show the
  // session as failed.
  if (type === RECORDING_NOTIFICATION_TYPES.failed) {
    return deviceId ? deviceRemoteSessionsAction(deviceId) : null;
  }

  // The storage is the tenant's: every device's sessions are where space is freed.
  if (isRecordingStorageNotificationType(type)) {
    return { label: 'Remote Sessions', route: routes.devices.remoteSessions };
  }

  // Only an announcement follows a link: on any other type the payload would be choosing
  // where an entity's notification leads.
  if (type === ANNOUNCEMENT_TYPE) {
    return link ? linkAction(link) : null;
  }

  // Unknown type. The contract requires new types to reach users without a client release —
  // "an unfamiliar string still routes by ids, never drops the message silently" — so route
  // by the entity ids rather than giving up.
  //
  // A ticket id is unambiguous. A bare dialog id is NOT: CLIENT_AI_MESSAGE carries a CLIENT
  // chat's dialogId, and Mingo resolves admin dialogs only, so following one blindly
  // would land on an empty chat. The category is what tells the two apart.
  if (ticketId) return { label: 'Ticket Details', route: ticketRoute(ticketId) };
  // An incident id outranks a Mingo dialog: a chat ABOUT an incident still names the incident.
  if (insightId) return incidentAction(insightId);
  if (dialogId && category === MINGO_CATEGORY) return mingoDialogAction(dialogId);
  if (recordingId) return recordingAction(recordingId);

  return null;
}

/**
 * Resolve the navigation action a notification offers (button label + route), or null when it
 * points at no entity the admin UI can open (e.g. a client-side AI dialog).
 */
export function resolveNotificationAction(notification: Notification): NotificationAction | null {
  const meta = notification.meta ?? {};
  return resolveAction(
    nonEmptyString(meta.notificationType),
    {
      ticketId: nonEmptyString(meta.ticketId),
      dialogId: nonEmptyString(meta.dialogId),
      insightId: nonEmptyString(meta.insightId),
      recordingId: nonEmptyString(meta.recordingId),
      deviceId: nonEmptyString(meta.deviceId),
      link: nonEmptyString(meta.link),
    },
    nonEmptyString(notification.category),
  );
}

/** The action's route inside the app; `null` for no action, and for a link that opens outside it. */
function actionRoute(action: NotificationAction | null): string | null {
  return action?.route ?? null;
}

/**
 * Action for a bag of wire fields, whatever transport carried them. Both shells hand over
 * untyped payloads, so every field is narrowed rather than trusted.
 * A returned route is BUILT by a `routes.*` builder from those narrowed ids, never echoed
 * from the payload, so a forged push cannot name its own destination. That is what
 * replaced the old `startsWith('/')` check on a server-supplied route string. The one
 * exception is an announcement's link, whose destination is the payload's by design and
 * is checked in `linkAction`.
 */
function actionFromWireFields(fields: Record<string, unknown>): NotificationAction | null {
  // `attributes` is the contract's home for the ids; the flat keys are where an FCM push
  // puts them (see resolvePushNotificationAction). Read the map first and fall back to the
  // flat keys.
  const attributes = readNotificationAttributes(fields.attributes);
  const fact = (key: keyof NotificationIds) => attributes[NOTIFICATION_ATTR[key]] ?? nonEmptyString(fields[key]);
  return resolveAction(
    nonEmptyString(fields.type),
    {
      ticketId: fact('ticketId'),
      dialogId: fact('dialogId'),
      insightId: fact('insightId'),
      recordingId: fact('recordingId'),
      deviceId: fact('deviceId'),
      link: fact('link'),
    },
    nonEmptyString(fields.category),
  );
}

/**
 * Action for a NATS notification envelope (`type`/`attributes`/`category` at the top
 * level), before it has been shaped into a store record — the desktop shell's OS-toast
 * click path (`notification:click` from the Rust notification plane) hands over the
 * envelope narrowed to its routing fields (its `click_payload`). Anything else on the
 * envelope is ignored.
 */
export function resolveNatsNotificationAction(payload: unknown): NotificationAction | null {
  const envelope = (payload ?? {}) as { type?: unknown; attributes?: unknown; category?: unknown };
  return actionFromWireFields({
    type: envelope.type,
    attributes: envelope.attributes,
    category: envelope.category,
  });
}

/**
 * Action for a push notification's FCM `data` payload — a FLAT string map, not the nested NATS
 * envelope, and the mobile shell's tap path.
 *
 * Reads the top-level keys only: the backend (`FcmPushSender.buildData`) writes `type` plus
 * every attribute (`ticketId`/`dialogId`/`insightId`/`link`, …) as a flat key, and drops any
 * larger blob whole when the payload would exceed FCM's size budget — so the flat keys are the
 * guaranteed half of the payload and the only half worth routing on.
 */
export function resolvePushNotificationAction(data: unknown): NotificationAction | null {
  return actionFromWireFields((data ?? {}) as Record<string, unknown>);
}

/**
 * Open a link action's page outside the app: a new tab on the web. In the shells
 * `window.open` is what hands an https page over to the system browser (desktop,
 * `handle_new_window` in `src-tauri/src/lib.rs`) or the in-app browser (mobile,
 * `ExternalLinksPlugin`).
 */
export function openNotificationLink(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * A tap that arrives from outside React — a push on the phone, an OS banner on the
 * desktop: open the link outside the app, else push the route, else the notifications
 * page, so a type this build does not know still lands somewhere useful.
 */
export function followNotificationTap(action: NotificationAction | null, navigate: (route: string) => void): void {
  if (action && isNotificationLinkAction(action)) {
    openNotificationLink(action.externalUrl);
    return;
  }
  navigate(action?.route ?? routes.notifications());
}

/** Convenience for callers that only need a router route. */
export function resolveNotificationRoute(notification: Notification): string | null {
  return actionRoute(resolveNotificationAction(notification));
}

/**
 * True when the notification carries the id of a dialog currently on screen. The classic
 * drawer's resting URL is one `notificationTargetsLocation` can never match (see it below),
 * so this is its drawer analogue — the caller supplies the active-view set from
 * `@/lib/active-dialog-views`. Matches by
 * `meta.dialogId` rather than the navigation action so ticket-linked Mingo messages
 * (whose action is the ticket route) still auto-read while their dialog is being watched.
 */
export function notificationTargetsDialog(notification: Notification, activeDialogs: ReadonlySet<string>): boolean {
  const dialogId = notification.meta?.dialogId;
  return typeof dialogId === 'string' && activeDialogs.has(dialogId);
}

/**
 * True when the current location is the entity a notification points at — its target route's
 * pathname matches and every query param it carries is present with the same value. Drives
 * auto-marking a notification read once the user opens its entity, uniformly for every entity
 * type the route mapping covers (mingo dialog, ticket, …).
 *
 * A Mingo dialog matches only in the Mingo-first shell, where its route (`/mingo/chat?id=`) is
 * the page that shows it. The classic shell redirects that route to the drawer, which floats
 * over whatever route is showing (`?mingoDialog=` on an arbitrary path), so there the drawer's
 * auto-read runs through `notificationTargetsDialog` instead, off the set of dialogs actually
 * on screen.
 *
 * An announcement's link into the app never matches (`readOnOpen`): the page is the
 * backoffice's pick, so being on it says nothing about having seen the announcement.
 */
export function notificationTargetsLocation(
  notification: Notification,
  pathname: string,
  searchParams: URLSearchParams,
): boolean {
  const action = resolveNotificationAction(notification);
  const route = action?.readOnOpen ? null : actionRoute(action);
  if (!route) return false;
  const [routePath, routeQuery] = route.split('?');
  if (routePath !== pathname) return false;
  if (!routeQuery) return true;
  for (const [key, value] of new URLSearchParams(routeQuery)) {
    if (searchParams.get(key) !== value) return false;
  }
  return true;
}
