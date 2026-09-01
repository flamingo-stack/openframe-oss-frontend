import { ADMIN_APPROVAL_REQUEST_CONTEXT_TYPE, type Notification } from '@flamingo-stack/openframe-frontend-core';
import { useMingoLauncherStore } from '@/app/(app)/mingo/stores/mingo-launcher-store';
import {
  isApprovalNotificationType,
  NOTIFICATION_ATTR,
  readNotificationAttributes,
} from '@/graphql/notifications/notification-attributes';
import { mingoDialogLink, routes } from '@/lib/routes';

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

/**
 * Context `type` → GraphQL `__typename`, so the NATS live path can rebuild typed context records.
 * LEGACY ONLY: a spec-shaped push carries `attributes` and needs no typed context record.
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
 * A notification's primary action. Every action has a `route` — a URL the host can
 * push, and the only thing a transport that runs OUTSIDE React (a push tap, an OS
 * toast) can act on.
 *
 * A Mingo dialog additionally carries `mingoDialogId`, because in-app it should
 * open the in-layout drawer rather than navigate. That is a preference, not a
 * substitute: `mingoDrawerDialogId` decides at CLICK time whether the drawer is
 * actually there, and the route is the fallback when it isn't.
 */
export type NotificationAction = { label: string; route: string; mingoDialogId?: string };

// routes.* builders URL-encode values via URLSearchParams — no manual encodeURIComponent.
const mingoDialogRoute = (dialogId: string) => mingoDialogLink(dialogId);
const ticketRoute = (ticketId: string, tab?: 'chat') => routes.tickets.dialog(ticketId, { tab });

/**
 * Action for a Mingo dialog: the canonical route ALWAYS, plus the drawer id.
 *
 * Deliberately reads no feature flag. This mapping is called from transports that
 * run before the flags query has answered — a cold-start push tap beats it every
 * time — and `featureFlags.*.enabled()` reports the env default in that window, so
 * a flag read here decides the destination by coin-flip. `/mingo` resolves it
 * instead, and that page already waits on a tri-state gate.
 */
const mingoDialogAction = (dialogId: string): NotificationAction => ({
  label: 'Open Chat',
  route: mingoDialogRoute(dialogId),
  mingoDialogId: dialogId,
});

/**
 * The dialog to open in the in-layout drawer for this action, or `null` to follow
 * `action.route` instead.
 *
 * Decided when the user acts, rather than in the mapping above, which runs before the
 * shell can answer. Asks `MingoLauncherStore.canOpen` — see that field for why the
 * feature flag alone is the wrong question.
 *
 * A render-phase caller must SUBSCRIBE to `canOpen` and pass it down; this reads the
 * store without one, so a value read during render never updates.
 */
export function mingoDrawerDialogId(action: NotificationAction): string | null {
  if (!action.mingoDialogId) return null;
  return useMingoLauncherStore.getState().canOpen ? action.mingoDialogId : null;
}

const nonEmptyString = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);

/** Backend `NotificationCategory` for Mingo — the signal that an unknown type's dialog is an admin one. */
const MINGO_CATEGORY = 'MINGO';

function resolveAction(
  type: string | null,
  ticketId: string | null,
  dialogId: string | null,
  category: string | null,
): NotificationAction | null {
  // Approval requests live in their ticket when one exists, otherwise the mingo dialog.
  // Covers the legacy discriminator and both spec types the catalog split it into.
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

  // Unknown type. The contract requires new types to reach users without a client release —
  // "an unfamiliar string still routes by ids, never drops the message silently" — so route
  // by the entity ids rather than giving up.
  //
  // A ticket id is unambiguous. A bare dialog id is NOT: CLIENT_AI_MESSAGE carries a CLIENT
  // chat's dialogId, and `/mingo?dialogId=` resolves admin dialogs only, so following one
  // blindly would land on an empty chat. The category is what tells the two apart.
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
  // (and the approval split folded onto it). Either identifies a route the same way.
  return resolveAction(
    nonEmptyString(meta.notificationType) ?? nonEmptyString(meta.contextType),
    nonEmptyString(meta.ticketId),
    nonEmptyString(meta.dialogId),
    nonEmptyString(notification.category),
  );
}

function actionRoute(action: NotificationAction | null): string | null {
  return action?.route ?? null;
}

/**
 * Route for a bag of wire fields, whatever transport carried them. Both shells hand over
 * untyped payloads, so every field is narrowed rather than trusted.
 * The returned route is always BUILT by a `routes.*` builder from those narrowed ids, never
 * echoed from the payload, so a forged push cannot name its own destination. That is what
 * replaced the old `startsWith('/')` check on a server-supplied route string.
 */
function routeFromWireFields(fields: Record<string, unknown>): string | null {
  // `attributes` is the spec contract's home for the ids; the flat keys are where the legacy
  // shape puts them. Both transports may carry either, so read the spec one first and fall back.
  //
  // NOT the row mapper's rule: `mapNotificationNode` reads the spec shape only. This path
  // deliberately keeps the fallback — it runs on cold-start taps (a desktop OS-toast click,
  // an FCM tap) whose payloads may come from an installed shell or a backend that predates
  // the context removal, and routing on whichever shape arrived costs nothing here.
  const attributes = readNotificationAttributes(fields.attributes);
  return actionRoute(
    resolveAction(
      nonEmptyString(fields.type),
      attributes[NOTIFICATION_ATTR.ticketId] ?? nonEmptyString(fields.ticketId),
      attributes[NOTIFICATION_ATTR.dialogId] ?? nonEmptyString(fields.dialogId),
      nonEmptyString(fields.category),
    ),
  );
}

/**
 * Route for a raw NATS notification envelope (`context.type/ticketId/dialogId`), before it has
 * been shaped into a store record — the desktop shell's OS-toast click path
 * (`notification:click` from the Rust notification plane) hands the wire payload over as-is.
 */
export function resolveNatsNotificationRoute(payload: unknown): string | null {
  const envelope = (payload ?? {}) as {
    type?: unknown;
    attributes?: unknown;
    category?: unknown;
    context?: Record<string, unknown>;
  };
  const context = envelope.context ?? {};
  // `type`/`attributes`/`category` sit at the TOP of the spec envelope, while the legacy ids
  // live inside `context` — flatten both into one bag for the shared resolver.
  return routeFromWireFields({
    type: envelope.type ?? context.type,
    attributes: envelope.attributes,
    ticketId: context.ticketId,
    dialogId: context.dialogId,
    category: envelope.category ?? context.category,
  });
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

/** Convenience for callers that only need a router route. */
export function resolveNotificationRoute(notification: Notification): string | null {
  return actionRoute(resolveNotificationAction(notification));
}

/**
 * True when the notification carries the id of a dialog currently on screen. The drawer's
 * resting URL is one `notificationTargetsLocation` can never match (see it below), so this
 * is its drawer analogue — the caller supplies the active-view set from
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
 * A Mingo dialog matches here only with `mingo-sidebar` OFF, where `/mingo?dialogId=` is the
 * legacy page's resting URL. With the flag on that route only ever redirects, and the drawer's
 * resting URL is `?mingoDialog=` on some other path — so the drawer's auto-read runs through
 * `notificationTargetsDialog` instead, off the set of dialogs actually on screen.
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
