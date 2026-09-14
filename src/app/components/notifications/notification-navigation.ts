import type { Notification } from '@flamingo-stack/openframe-frontend-core';
import { useMingoLauncherStore } from '@/app/(app)/mingo/stores/mingo-launcher-store';
import {
  isApprovalNotificationType,
  NOTIFICATION_ATTR,
  readNotificationAttributes,
} from '@/graphql/notifications/notification-attributes';
import { mingoDialogLink, routes } from '@/lib/routes';

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
 * excluded — that conversation lives in the sidebar drawer, not the page's Client Chat
 * tab.
 */
const TICKET_CHAT_TYPES = new Set<string>([
  CUSTOMER_MESSAGE_PUBLISHED_TYPE,
  ADMIN_MESSAGE_PUBLISHED_TYPE,
  CLIENT_AI_MESSAGE_TYPE,
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
 * The route is the fallback for when there is no drawer to open into (subscription
 * lock, shell unmounted); `mingoDrawerDialogId` below decides between the two when
 * the user actually acts, rather than here, where nothing can answer yet.
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

  // Unknown type. The contract requires new types to reach users without a client release —
  // "an unfamiliar string still routes by ids, never drops the message silently" — so route
  // by the entity ids rather than giving up.
  //
  // A ticket id is unambiguous. A bare dialog id is NOT: CLIENT_AI_MESSAGE carries a CLIENT
  // chat's dialogId, and the Mingo drawer resolves admin dialogs only, so following one
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
  return resolveAction(
    nonEmptyString(meta.notificationType),
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
  // `attributes` is the contract's home for the ids; the flat keys are where an FCM push
  // puts them (see resolvePushNotificationRoute). Read the map first and fall back to the
  // flat keys.
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
 * Route for a NATS notification envelope (`type`/`attributes`/`category` at the top
 * level), before it has been shaped into a store record — the desktop shell's OS-toast
 * click path (`notification:click` from the Rust notification plane) hands over the
 * envelope narrowed to `type` + `attributes` (its `click_payload`). Anything else on
 * the envelope is ignored.
 */
export function resolveNatsNotificationRoute(payload: unknown): string | null {
  const envelope = (payload ?? {}) as { type?: unknown; attributes?: unknown; category?: unknown };
  return routeFromWireFields({
    type: envelope.type,
    attributes: envelope.attributes,
    category: envelope.category,
  });
}

/**
 * Route for a push notification's FCM `data` payload — a FLAT string map, not the nested NATS
 * envelope, and the mobile shell's tap path.
 *
 * Reads the top-level keys only: the backend (`FcmPushSender.buildData`) writes `type` plus
 * the `PushActionable` ids (`ticketId`/`dialogId`) as flat keys, and drops any larger blob
 * whole when the payload would exceed FCM's size budget — so the flat ids are the guaranteed
 * half of the payload and the only half worth routing on.
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
 * A Mingo dialog never matches here: the drawer floats over whatever route is showing, so its
 * resting URL is `?mingoDialog=` on an arbitrary path rather than a route this can compare
 * against. The drawer's auto-read runs through `notificationTargetsDialog` instead, off the set
 * of dialogs actually on screen.
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
