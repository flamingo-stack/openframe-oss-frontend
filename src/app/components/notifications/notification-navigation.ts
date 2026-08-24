import { ADMIN_APPROVAL_REQUEST_CONTEXT_TYPE, type Notification } from '@flamingo-stack/openframe-frontend-core';
import {
  isApprovalNotificationType,
  NOTIFICATION_ATTR,
  readNotificationAttributes,
} from '@/graphql/notifications/notifications-helpers';
import { featureFlags } from '@/lib/feature-flags';
import { routes } from '@/lib/routes';

// Backend notification type discriminators. The spec catalog's top-level `type` and the legacy
// `NotificationContext.type` use the SAME strings for these, so one set routes both shapes — the
// only divergence is approvals, which the catalog splits in two (see isApprovalNotificationType).
// Membership here is an optimization: it picks the right tab. An unrecognized type still routes
// by entity id, so this list never has to be exhaustive for navigation to work.
export const ADMIN_AI_MESSAGE_CONTEXT_TYPE = 'ADMIN_AI_MESSAGE';
export const ADMIN_AI_TICKET_MESSAGE_CONTEXT_TYPE = 'ADMIN_AI_TICKET_MESSAGE';
export const CLIENT_AI_MESSAGE_CONTEXT_TYPE = 'CLIENT_AI_MESSAGE';
export const TICKET_STATUS_CHANGED_CONTEXT_TYPE = 'TICKET_STATUS_CHANGED';
// A reopen transition REPLACES the generic status-change notification server-side —
// without this mapping reopens would be invisible (no navigation, no auto-read).
export const TICKET_REOPENED_CONTEXT_TYPE = 'TICKET_REOPENED';
export const TICKET_ASSIGNED_CONTEXT_TYPE = 'TICKET_ASSIGNED';
export const TICKET_ESCALATED_BY_USER_CONTEXT_TYPE = 'TICKET_ESCALATED_BY_USER';
export const CUSTOMER_MESSAGE_PUBLISHED_CONTEXT_TYPE = 'CUSTOMER_MESSAGE_PUBLISHED';
export const ADMIN_MESSAGE_PUBLISHED_CONTEXT_TYPE = 'ADMIN_MESSAGE_PUBLISHED';

/**
 * Context `type` → GraphQL `__typename`, so the NATS live path can rebuild typed context records.
 * LEGACY ONLY: a spec-shaped push carries `attributes` and needs no typed context record at all.
 */
export const CONTEXT_TYPENAME_BY_TYPE: Record<string, string> = {
  [ADMIN_APPROVAL_REQUEST_CONTEXT_TYPE]: 'AdminApprovalRequestContext',
  [ADMIN_AI_MESSAGE_CONTEXT_TYPE]: 'AdminAiMessageContext',
  [ADMIN_AI_TICKET_MESSAGE_CONTEXT_TYPE]: 'AdminAiTicketMessageContext',
  [CLIENT_AI_MESSAGE_CONTEXT_TYPE]: 'ClientAiMessageContext',
  [TICKET_STATUS_CHANGED_CONTEXT_TYPE]: 'TicketStatusChangedContext',
  [TICKET_REOPENED_CONTEXT_TYPE]: 'TicketReopenedContext',
  [TICKET_ASSIGNED_CONTEXT_TYPE]: 'TicketAssignedContext',
  [TICKET_ESCALATED_BY_USER_CONTEXT_TYPE]: 'TicketEscalatedByUserContext',
  [CUSTOMER_MESSAGE_PUBLISHED_CONTEXT_TYPE]: 'CustomerMessagePublishedContext',
  [ADMIN_MESSAGE_PUBLISHED_CONTEXT_TYPE]: 'AdminMessagePublishedContext',
};

/**
 * Types whose entity is a ticket; they navigate to the ticket dialog via `ticketId`.
 * CLIENT_AI_MESSAGE belongs here only when its dialog is ticket-linked — `ticketId` is
 * nullable on that context (a Fae chat can run without a ticket), and without one the
 * notification resolves to no action, same as before the field existed.
 */
const TICKET_CONTEXT_TYPES = new Set<string>([
  ADMIN_AI_TICKET_MESSAGE_CONTEXT_TYPE,
  TICKET_STATUS_CHANGED_CONTEXT_TYPE,
  TICKET_REOPENED_CONTEXT_TYPE,
  TICKET_ASSIGNED_CONTEXT_TYPE,
  TICKET_ESCALATED_BY_USER_CONTEXT_TYPE,
  CUSTOMER_MESSAGE_PUBLISHED_CONTEXT_TYPE,
  ADMIN_MESSAGE_PUBLISHED_CONTEXT_TYPE,
  CLIENT_AI_MESSAGE_CONTEXT_TYPE,
]);

/**
 * Ticket types announcing a new message in the ticket's client chat; they land on the
 * Chat tab instead of Details. Mingo ticket messages (`ADMIN_AI_TICKET_MESSAGE`) are
 * excluded — with `mingo-sidebar-context` on, that conversation lives in the sidebar
 * drawer, not the page's Client Chat tab.
 */
const TICKET_CHAT_CONTEXT_TYPES = new Set<string>([
  CUSTOMER_MESSAGE_PUBLISHED_CONTEXT_TYPE,
  ADMIN_MESSAGE_PUBLISHED_CONTEXT_TYPE,
  CLIENT_AI_MESSAGE_CONTEXT_TYPE,
]);

/**
 * A notification's primary action. Either a plain `route` the host pushes onto
 * the router, or — for a Mingo dialog once the standalone `/mingo` page is
 * retired behind `mingo-sidebar` — a `mingoDialogId` the host opens in the
 * in-layout chat drawer (the drawer has no URL, so it can't be a route).
 */
export type NotificationAction = { label: string; route: string } | { label: string; mingoDialogId: string };

// routes.* builders URL-encode values via URLSearchParams — no manual encodeURIComponent.
const mingoDialogRoute = (dialogId: string) => routes.mingo({ dialogId });
const ticketRoute = (ticketId: string, tab?: 'chat') => routes.tickets.dialog(ticketId, { tab });

/**
 * Action for a Mingo dialog. With `mingo-sidebar` ON the `/mingo` page is gone
 * (it redirects to the dashboard), so the dialog opens in the in-layout drawer
 * via `mingoDialogId`; the consumer drives the shared Mingo store. Legacy (flag
 * OFF) still routes to the page. Tickets are unaffected — they always route.
 */
const mingoDialogAction = (dialogId: string): NotificationAction =>
  featureFlags.mingoSidebar.enabled()
    ? { label: 'Open Chat', mingoDialogId: dialogId }
    : { label: 'Open Chat', route: mingoDialogRoute(dialogId) };

/** Backend `NotificationCategory` for Mingo — the signal that an unknown type's dialog is an admin one. */
const MINGO_CATEGORY = 'MINGO';

function resolveAction(
  type: string | null,
  ticketId: string | null,
  dialogId: string | null,
  category: string | null,
): NotificationAction | null {
  // Approval requests live in their ticket when one exists, otherwise the mingo dialog.
  // Covers the legacy discriminator and both spec types it was split into.
  if (isApprovalNotificationType(type)) {
    if (ticketId) return { label: 'Ticket Details', route: ticketRoute(ticketId) };
    if (dialogId) return mingoDialogAction(dialogId);
    return null;
  }

  if (type && TICKET_CONTEXT_TYPES.has(type) && ticketId) {
    const tab = TICKET_CHAT_CONTEXT_TYPES.has(type) ? 'chat' : undefined;
    return { label: 'Ticket Details', route: ticketRoute(ticketId, tab) };
  }

  if (type === ADMIN_AI_MESSAGE_CONTEXT_TYPE && dialogId) {
    return mingoDialogAction(dialogId);
  }

  // Unknown type — the contract says new ones ship without a client release, so route by
  // the entity ids instead of giving up. A ticket id is unambiguous. A dialog id is not:
  // CLIENT_AI_MESSAGE carries a CLIENT chat's dialogId, which the admin Mingo drawer cannot
  // open, so a bare dialog is only followed when the category says the dialog is Mingo's.
  if (ticketId) return { label: 'Ticket Details', route: ticketRoute(ticketId) };
  if (dialogId && category === MINGO_CATEGORY) return mingoDialogAction(dialogId);

  return null;
}

/**
 * Resolve the navigation action a notification offers (button label + route), or null when it
 * points at no entity the admin UI can open (e.g. a client-side AI dialog).
 */
export function resolveNotificationAction(notification: Notification): NotificationAction | null {
  const meta = notification.meta ?? {};
  // `notificationType` is the precise spec type; `contextType` is the legacy discriminator
  // (and the approval split folded back onto it). Either identifies a route the same way.
  const type = typeof meta.notificationType === 'string' ? meta.notificationType : meta.contextType;
  return resolveAction(
    typeof type === 'string' ? type : null,
    typeof meta.ticketId === 'string' ? meta.ticketId : null,
    typeof meta.dialogId === 'string' ? meta.dialogId : null,
    typeof notification.category === 'string' ? notification.category : null,
  );
}

/**
 * Route for a raw NATS notification envelope, before it has been shaped into a store record —
 * the native shell's OS-toast click path (`notification:click` from the Rust notification
 * plane) hands the wire payload over as-is. Reads `type`/`attributes` when the envelope carries
 * them and the legacy `context` otherwise, so a shell build that still forwards only the old
 * shape keeps working. Drawer-only actions (mingoDialogId) have no URL and resolve to null —
 * callers fall back.
 */
export function resolveNatsNotificationRoute(payload: unknown): string | null {
  const envelope = (payload ?? {}) as {
    type?: unknown;
    attributes?: unknown;
    category?: unknown;
    context?: Record<string, unknown>;
  };
  const context = envelope.context ?? {};
  const attributes = readNotificationAttributes(envelope.attributes);
  const str = (value: unknown) => (typeof value === 'string' && value ? value : null);
  const action = resolveAction(
    str(envelope.type) ?? str(context.type),
    attributes[NOTIFICATION_ATTR.ticketId] ?? str(context.ticketId),
    attributes[NOTIFICATION_ATTR.dialogId] ?? str(context.dialogId),
    str(envelope.category),
  );
  return action && 'route' in action ? action.route : null;
}

/**
 * Route for a mobile push's FCM data payload.
 *
 * The backend deliberately does NOT send a ready-made route — its own test says so: the data
 * payload "carries id/type/category/severity AND the context's own fields — the client routes
 * off this, so it can change deep-linking without a backend release". So the mapping lives
 * here, on the same `resolveAction` the drawer and the desktop toast use.
 *
 * The payload is FLAT, unlike the NATS envelope: `type`, `ticketId`, `dialogId` and
 * `approvalRequestId` ride as top-level keys precisely so they survive when the serialized
 * `context` blob is dropped for exceeding the push size cap. Flat keys are therefore read
 * FIRST, with the blob only as a backstop; `attributes` is read ahead of both for when the
 * backend moves this payload onto the spec contract.
 */
export function resolveNativePushRoute(data: Record<string, unknown> | null | undefined): string | null {
  if (!data) return null;
  const str = (value: unknown) => (typeof value === 'string' && value ? value : null);
  const attributes = readNotificationAttributes(data.attributes);
  // `context` arrives as a JSON string here (it is one value in a string->string map), and is
  // absent entirely on a payload whose context exceeded the cap.
  let blob: Record<string, unknown> | null = null;
  if (typeof data.context === 'string') {
    try {
      const parsed = JSON.parse(data.context);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) blob = parsed;
    } catch {
      blob = null;
    }
  }

  const action = resolveAction(
    str(data.type) ?? str(blob?.type),
    attributes[NOTIFICATION_ATTR.ticketId] ?? str(data.ticketId) ?? str(blob?.ticketId),
    attributes[NOTIFICATION_ATTR.dialogId] ?? str(data.dialogId) ?? str(blob?.dialogId),
    str(data.category),
  );
  return action && 'route' in action ? action.route : null;
}

/** Convenience for callers that only need a router route (drawer actions yield null). */
export function resolveNotificationRoute(notification: Notification): string | null {
  const action = resolveNotificationAction(notification);
  return action && 'route' in action ? action.route : null;
}

/**
 * True when the notification carries the id of a dialog currently on screen. The drawer
 * changes no URL, so this is the drawer analogue of `notificationTargetsLocation` — the
 * caller supplies the active-view set from `@/lib/active-dialog-views`. Matches by
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
 */
export function notificationTargetsLocation(
  notification: Notification,
  pathname: string,
  searchParams: URLSearchParams,
): boolean {
  const route = resolveNotificationRoute(notification);
  if (!route) return false;
  const [routePath, routeQuery] = route.split('?');
  if (routePath !== pathname) return false;
  if (!routeQuery) return true;
  for (const [key, value] of new URLSearchParams(routeQuery)) {
    if (searchParams.get(key) !== value) return false;
  }
  return true;
}
