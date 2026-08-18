import { ADMIN_APPROVAL_REQUEST_CONTEXT_TYPE, type Notification } from '@flamingo-stack/openframe-frontend-core';
import { featureFlags } from '@/lib/feature-flags';
import { routes } from '@/lib/routes';

// Backend `NotificationContext.type` discriminators (the string `type` field; the same set the
// concrete `__typename` subtypes carry in schema.graphql). NATS payloads carry only this string,
// so it is the single source of truth for both routing and reconstructing store records live.
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

/** Context `type` → GraphQL `__typename`, so the NATS live path can rebuild typed context records. */
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
 * Context types whose entity is a ticket; they navigate to the ticket dialog via `ticketId`.
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
 * Ticket contexts announcing a new message in the ticket's client chat; they land on the
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

function resolveAction(
  contextType: string | null,
  ticketId: string | null,
  dialogId: string | null,
): NotificationAction | null {
  // Approval requests live in their ticket when one exists, otherwise the mingo dialog.
  if (contextType === ADMIN_APPROVAL_REQUEST_CONTEXT_TYPE) {
    if (ticketId) return { label: 'Ticket Details', route: ticketRoute(ticketId) };
    if (dialogId) return mingoDialogAction(dialogId);
    return null;
  }

  if (contextType && TICKET_CONTEXT_TYPES.has(contextType) && ticketId) {
    const tab = TICKET_CHAT_CONTEXT_TYPES.has(contextType) ? 'chat' : undefined;
    return { label: 'Ticket Details', route: ticketRoute(ticketId, tab) };
  }

  if (contextType === ADMIN_AI_MESSAGE_CONTEXT_TYPE && dialogId) {
    return mingoDialogAction(dialogId);
  }

  return null;
}

/**
 * Resolve the navigation action a notification offers (button label + route), or null when it
 * points at no entity the admin UI can open (e.g. a client-side AI dialog).
 */
export function resolveNotificationAction(notification: Notification): NotificationAction | null {
  const meta = notification.meta ?? {};
  return resolveAction(
    typeof meta.contextType === 'string' ? meta.contextType : null,
    typeof meta.ticketId === 'string' ? meta.ticketId : null,
    typeof meta.dialogId === 'string' ? meta.dialogId : null,
  );
}

const nonEmptyString = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);

/**
 * Route for a bag of wire fields, whatever transport carried them. Both shells hand over
 * untyped payloads, so every field is narrowed rather than trusted. Drawer-only actions
 * (mingoDialogId) have no URL and resolve to null — callers fall back.
 *
 * The returned route is always BUILT by a `routes.*` builder from those narrowed ids, never
 * echoed from the payload, so a forged push cannot name its own destination. That is what
 * replaced the old `startsWith('/')` check on a server-supplied route string.
 */
function routeFromWireFields(fields: Record<string, unknown>): string | null {
  const action = resolveAction(
    nonEmptyString(fields.type),
    nonEmptyString(fields.ticketId),
    nonEmptyString(fields.dialogId),
  );
  return action && 'route' in action ? action.route : null;
}

/**
 * Route for a raw NATS notification envelope (`context.type/ticketId/dialogId`), before it has
 * been shaped into a store record — the desktop shell's OS-toast click path
 * (`notification:click` from the Rust notification plane) hands the wire payload over as-is.
 */
export function resolveNatsNotificationRoute(payload: unknown): string | null {
  return routeFromWireFields((payload as { context?: Record<string, unknown> } | null | undefined)?.context ?? {});
}

/**
 * Route for a push notification's FCM `data` payload — a FLAT string map, not the nested NATS
 * envelope, and the mobile shell's tap path.
 *
 * Reads the top-level keys only, never the serialized `context`: the backend
 * (`FcmPushSender.buildData`) DROPS that blob whole when the payload would exceed FCM's size
 * budget, and writes `type` plus the `PushActionable` ids (`ticketId`/`dialogId`) as flat keys
 * for exactly that reason. Every notification context implements `PushActionable`, so the flat
 * ids are the guaranteed half of the payload and the only half worth routing on.
 */
export function resolvePushNotificationRoute(data: unknown): string | null {
  return routeFromWireFields((data ?? {}) as Record<string, unknown>);
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
