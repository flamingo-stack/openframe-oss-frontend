import {
  ADMIN_APPROVAL_REQUEST_CONTEXT_TYPE,
  type ApprovalToolCallMeta,
  type Notification,
  type NotificationVariant,
} from '@flamingo-stack/openframe-frontend-core';
import { ConnectionHandler, type RecordSourceSelectorProxy, readInlineData } from 'relay-runtime';
import type {
  notificationFields_notification$data as NotificationFieldsData,
  notificationFields_notification$key as NotificationFieldsKey,
} from '@/__generated__/notificationFields_notification.graphql';
import type { NotificationSeverity } from '@/generated/schema-enums';
import { featureFlags } from '@/lib/feature-flags';
import {
  isApprovalNotificationType,
  NOTIFICATION_ATTR,
  normalizeToolCalls,
  parseAttributeToolCalls,
  readNotificationAttributes,
  toLegacyContextType,
} from './notification-attributes';
import { notificationFieldsFragment } from './notification-fields';

export {
  isApprovalNotificationType,
  isApprovalResolved,
  MINGO_APPROVAL_REQUEST_TYPE,
  NOTIFICATION_ATTR,
  normalizeToolCalls,
  parseAttributeToolCalls,
  readNotificationAttributes,
  TICKET_APPROVAL_REQUEST_TYPE,
  toLegacyContextType,
} from './notification-attributes';

export const NOTIFICATIONS_CONNECTION_KEY = 'NotificationsList_notifications';
const NOTIFICATION_EDGE_TYPENAME = 'NotificationEdge';

export interface NotificationsConnectionFilters {
  filter: { read: boolean };
  search: string | null;
}

export interface NotificationConnectionPair {
  unread: NotificationsConnectionFilters;
  read: NotificationsConnectionFilters;
}

export function notificationsConnectionFilters(read: boolean, search: string): NotificationsConnectionFilters {
  const trimmed = search.trim();
  return { filter: { read }, search: trimmed || null };
}

export const UNFILTERED_NOTIFICATION_PAIR: NotificationConnectionPair = {
  unread: notificationsConnectionFilters(false, ''),
  read: notificationsConnectionFilters(true, ''),
};

const UNREAD_COUNTS_FIELD = 'unreadCountsByCategory';
const UNREAD_CATEGORY_COUNT_TYPENAME = 'UnreadCategoryCount';

/**
 * Adjust the in-store per-category unread count (the `unreadCountsByCategory` root field that
 * drives the sidebar badges) so it stays in lockstep with the drawer connection in the same
 * local transaction — no refetch race. `category` is the backend `NotificationCategory` carried
 * on the node / NATS payload; the bucket it lands in is the same enum value the sidebar reads.
 * No-op when counts aren't loaded yet — the hydrator fetches authoritative values on mount.
 */
export function adjustUnreadCount(store: RecordSourceSelectorProxy, category: unknown, delta: number): void {
  if (typeof category !== 'string' || delta === 0) return;
  const buckets = store.getRoot().getLinkedRecords(UNREAD_COUNTS_FIELD);
  if (!buckets) return;
  const existing = buckets.find(bucket => bucket?.getValue('category') === category);
  if (existing) {
    const current = Number(existing.getValue('count')) || 0;
    existing.setValue(Math.max(0, current + delta), 'count');
    return;
  }
  if (delta < 0) return;
  const bucketId = `client:${UNREAD_CATEGORY_COUNT_TYPENAME}:${category}`;
  const bucket = store.get(bucketId) ?? store.create(bucketId, UNREAD_CATEGORY_COUNT_TYPENAME);
  bucket.setValue(category, 'category');
  bucket.setValue(delta, 'count');
  store.getRoot().setLinkedRecords([...buckets, bucket], UNREAD_COUNTS_FIELD);
}

/** Zero every per-category unread bucket — used when all notifications are marked read at once. */
export function clearUnreadCounts(store: RecordSourceSelectorProxy): void {
  const buckets = store.getRoot().getLinkedRecords(UNREAD_COUNTS_FIELD);
  if (!buckets) return;
  for (const bucket of buckets) bucket?.setValue(0, 'count');
}

export function makeMarkReadUpdater(
  id: string,
  pairs: NotificationConnectionPair[],
  options: { adjustCount?: boolean } = {},
) {
  return (store: RecordSourceSelectorProxy) => {
    const node = store.get(id);
    if (!node) return;
    // Decrement the category bucket only when the node was actually unread, and only when the
    // caller owns the count change (the NATS auto-read path lands straight in the read connection
    // without ever incrementing, so it must not decrement here).
    if (options.adjustCount !== false && node.getValue('read') === false) {
      adjustUnreadCount(store, node.getValue('category'), -1);
    }
    node.setValue(true, 'read');

    const root = store.getRoot();
    const seen = new Set<string>();
    for (const pair of pairs) {
      const unreadConn = ConnectionHandler.getConnection(root, NOTIFICATIONS_CONNECTION_KEY, pair.unread);
      if (unreadConn && !seen.has(unreadConn.getDataID())) {
        seen.add(unreadConn.getDataID());
        ConnectionHandler.deleteNode(unreadConn, id);
      }
      const readConn = ConnectionHandler.getConnection(root, NOTIFICATIONS_CONNECTION_KEY, pair.read);
      if (readConn && !seen.has(readConn.getDataID())) {
        seen.add(readConn.getDataID());
        const edge = ConnectionHandler.createEdge(store, readConn, node, NOTIFICATION_EDGE_TYPENAME);
        ConnectionHandler.insertEdgeBefore(readConn, edge);
      }
    }
  };
}

export function makeMarkAllReadUpdater(pairs: NotificationConnectionPair[]) {
  return (store: RecordSourceSelectorProxy) => {
    const root = store.getRoot();
    const seen = new Set<string>();

    for (const pair of pairs) {
      const unreadConn = ConnectionHandler.getConnection(root, NOTIFICATIONS_CONNECTION_KEY, pair.unread);
      if (!unreadConn) continue;
      const unreadId = unreadConn.getDataID();
      if (seen.has(unreadId)) continue;
      seen.add(unreadId);

      const readConn = ConnectionHandler.getConnection(root, NOTIFICATIONS_CONNECTION_KEY, pair.read);
      let readConnForInsert = readConn;
      if (readConn) {
        if (seen.has(readConn.getDataID())) {
          readConnForInsert = null;
        } else {
          seen.add(readConn.getDataID());
        }
      }

      const edges = unreadConn.getLinkedRecords('edges') ?? [];
      for (const edge of edges) {
        const node = edge.getLinkedRecord('node');
        if (!node) continue;
        node.setValue(true, 'read');
        if (readConnForInsert) {
          const movedEdge = ConnectionHandler.createEdge(store, readConnForInsert, node, NOTIFICATION_EDGE_TYPENAME);
          ConnectionHandler.insertEdgeBefore(readConnForInsert, movedEdge);
        }
      }
      unreadConn.setLinkedRecords([], 'edges');
      const pageInfo = unreadConn.getLinkedRecord('pageInfo');
      if (pageInfo) {
        pageInfo.setValue(false, 'hasNextPage');
        pageInfo.setValue(null, 'endCursor');
      }
    }
    // Backend marks every notification read (not just the loaded ones), so clear all buckets.
    clearUnreadCounts(store);
  };
}

export function makeDeleteAllReadUpdater(pairs: NotificationConnectionPair[]) {
  return (store: RecordSourceSelectorProxy) => {
    const root = store.getRoot();
    const seen = new Set<string>();
    for (const pair of pairs) {
      const readConn = ConnectionHandler.getConnection(root, NOTIFICATIONS_CONNECTION_KEY, pair.read);
      if (!readConn) continue;
      const connId = readConn.getDataID();
      if (seen.has(connId)) continue;
      seen.add(connId);

      readConn.setLinkedRecords([], 'edges');
      const pageInfo = readConn.getLinkedRecord('pageInfo');
      if (pageInfo) {
        pageInfo.setValue(false, 'hasNextPage');
        pageInfo.setValue(null, 'endCursor');
      }
    }
  };
}

export function makeDeleteNotificationUpdater(id: string, pairs: NotificationConnectionPair[]) {
  return (store: RecordSourceSelectorProxy) => {
    const node = store.get(id);
    // Deleting an unread notification frees its category bucket; capture both before removal.
    const wasUnread = node?.getValue('read') === false;
    const category = node?.getValue('category');
    const root = store.getRoot();
    const seen = new Set<string>();
    for (const pair of pairs) {
      for (const filters of [pair.unread, pair.read]) {
        const conn = ConnectionHandler.getConnection(root, NOTIFICATIONS_CONNECTION_KEY, filters);
        if (!conn) continue;
        const connId = conn.getDataID();
        if (seen.has(connId)) continue;
        seen.add(connId);
        ConnectionHandler.deleteNode(conn, id);
      }
    }
    if (wasUnread) adjustUnreadCount(store, category, -1);
  };
}

type KnownSeverity = 'INFO' | 'SUCCESS' | 'WARNING' | 'DANGER';

const KNOWN_SEVERITIES: ReadonlySet<string> = new Set<KnownSeverity>(['INFO', 'SUCCESS', 'WARNING', 'DANGER']);

// Takes a plain string: the fragment's severity is an enum union that also
// carries Relay's `"%future added value"`, and dropping an unknown value is
// exactly what this does.
function normalizeSeverity(value: string | undefined): KnownSeverity | undefined {
  return value && KNOWN_SEVERITIES.has(value) ? (value as KnownSeverity) : undefined;
}

export function severityToVariant(severity: KnownSeverity | undefined): NotificationVariant {
  switch (severity) {
    case 'DANGER':
      return 'error';
    case 'WARNING':
      return 'warning';
    case 'SUCCESS':
      return 'success';
    case 'INFO':
      return 'info';
    default:
      return 'default';
  }
}

export function parseSeverity(
  input: NotificationSeverity | Lowercase<NotificationSeverity> | undefined,
): KnownSeverity | undefined {
  if (!input) return undefined;
  const upper = String(input).toUpperCase();
  return KNOWN_SEVERITIES.has(upper) ? (upper as KnownSeverity) : undefined;
}

/**
 * Human label for a notification type discriminator: SNAKE_CASE → Title Case
 * (e.g. TICKET_STATUS_CHANGED → "Ticket Status Changed"). Data-driven so new backend
 * types label themselves; the catch-all discriminators carry no meaning → undefined.
 * Fed the spec `type` when present, the legacy `context.type` otherwise.
 */
export function contextTypeLabel(contextType: string | null | undefined): string | undefined {
  if (!contextType || contextType === 'UNKNOWN' || contextType === 'GENERIC') return undefined;
  return contextType
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Defensive plain-text pass over notification title/description: strips common markdown
 * and HTML artifacts so previews (drawer tiles, table rows, OS toasts) never show raw
 * formatting. Canonical sanitization belongs on the BE at emission time (ClickUp 86ajn8hpg);
 * this only guards records written before that fix and any stragglers.
 */
export function stripNotificationMarkup(text: string): string {
  return (
    text
      .replace(/<[^>]+>/g, '') // HTML tags
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1') // images -> alt text
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // links -> label
      .replace(/(\*{1,3}|_{1,3}|~~)(\S(?:.*?\S)?)\1/g, '$2') // bold / italic / strikethrough
      .replace(/`{1,3}([^`]*)`{1,3}/g, '$1') // inline / fenced code
      .replace(/^[^\S\n]{0,3}#{1,6}[^\S\n]+/gm, '') // headings
      .replace(/[^\S\n]#{2,6}[^\S\n]+/g, ' ') // stray mid-line heading markers ("text. ## Summary"); 2+ hashes so "#238" survives
      .replace(/^[^\S\n]{0,3}>[^\S\n]?/gm, '') // blockquotes
      .replace(/^[^\S\n]{0,3}(?:[-*+]|\d+\.)[^\S\n]+/gm, '') // list markers
      // Collapse whitespace within lines only - newlines survive so the full-text
      // hover/tooltip keeps its paragraph structure (clamped previews ignore them anyway).
      .replace(/[^\S\n]+/g, ' ')
      .replace(/ ?\n ?/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
}

const EPOCH_MS_THRESHOLD = 1e12;

function toEpochMs(value: number): number {
  return value < EPOCH_MS_THRESHOLD ? value * 1000 : value;
}

export function parseCreatedAt(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return toEpochMs(value);
  if (typeof value === 'string') {
    const asNumber = Number(value);
    if (Number.isFinite(asNumber)) return toEpochMs(asNumber);
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return Date.now();
}

/** Reads a `notificationFields_notification` spread off either list's edges. */
export function readNotificationNode(ref: NotificationFieldsKey): NotificationFieldsData {
  return readInlineData(notificationFieldsFragment, ref);
}

/**
 * Flattens a notification row into the core lib's `Notification`. Takes the read
 * data rather than the fragment reference, so a caller that also needs the raw
 * fields (the section table's own columns) reads the node once.
 *
 * Reads exactly ONE of the two contracts — the spec pair (`type` + `attributes`) by
 * default, the legacy typed `context` when the rollback lever is on — never a mix of
 * both. A row that carries only the other shape still maps: it keeps its title, body,
 * severity and timestamp, and offers no type or entity metadata (so: a plain tile, no
 * navigation). See the lever comment inside for why that is the intended outcome.
 */
export function mapNotificationNode(node: NotificationFieldsData): Notification {
  const severity = normalizeSeverity(node.severity);

  /**
   * Which contract this release reads. Normally the spec one; the `notifications-legacy-path`
   * flag switches back to the typed `context` without a release, should attributes turn out
   * wrong in production.
   *
   * The switch is EXCLUSIVE: the shape the lever does not select is not read on any field,
   * and a row carrying only that shape maps with no type and no entity ids rather than
   * quietly answering from the other contract. That is the point — what the UI shows is
   * always the shape the lever names, so a rollback is a clean swap and never a per-row
   * mixture nobody can reason about. The cost is real and expected: with the lever OFF,
   * rows the backfill migration has not swept yet (no `attributes`) lose their navigation
   * until it has, and with it ON, spec-path rows that carry no context lose theirs.
   *
   * Zeroing the unselected side ONCE, here, is what makes that hold for the whole map —
   * the `...attributes` spread below included, so unknown spec keys cannot leak into `meta`
   * behind the lever's back.
   */
  const readLegacy = featureFlags.notificationsLegacyPath.enabled();
  const context = readLegacy ? node.context : null;
  const attributes: Record<string, string> = readLegacy ? {} : readNotificationAttributes(node.attributes);
  /** One fact, read off the selected shape only — there is no cross-shape fallback. */
  const pick = <T>(spec: T | undefined | null, legacy: T | undefined | null): T | undefined =>
    (readLegacy ? legacy : spec) ?? undefined;

  const notificationType = pick(node.type, context?.type);

  const meta: Record<string, unknown> = {
    // Every attribute the backend sent, including keys this release has no code for.
    ...attributes,
    notificationType,
    // What the core lib's approval gate reads — the approval split folded back onto one string.
    contextType: toLegacyContextType(notificationType),
  };

  // Entity ids drive navigation and auto-read uniformly across types (see
  // resolveNotificationAction). Under `attributes` they sit at fixed keys for every type,
  // known or not; the context aliases below are not a fallback across shapes — they are one
  // shape's own spelling variants, since the union declares the same field with different
  // nullability per member.
  const ticketId = pick(
    attributes[NOTIFICATION_ATTR.ticketId],
    context?.ticketId ?? context?.approvalTicketId ?? context?.clientTicketId,
  );
  const dialogId = pick(attributes[NOTIFICATION_ATTR.dialogId], context?.dialogId);
  if (dialogId) meta.dialogId = dialogId;
  if (ticketId) meta.ticketId = ticketId;

  const approvalRequestId = pick(attributes[NOTIFICATION_ATTR.approvalRequestId], context?.approvalRequestId);
  if (approvalRequestId) {
    meta.approvalRequestId = approvalRequestId;
    meta.approvalType = pick(attributes[NOTIFICATION_ATTR.approvalType], context?.approvalType) ?? null;
    meta.resolution = pick(attributes[NOTIFICATION_ATTR.resolution], context?.resolution) ?? null;
    meta.resolvedByName = pick(attributes[NOTIFICATION_ATTR.resolvedByName], context?.resolvedByName) ?? null;
    // Must end up an ARRAY: the core lib's `getApprovalMeta` bails on anything else, which
    // would silently downgrade the approval tile to a plain one. On the spec path the spread
    // above put the raw JSON string here, so this assignment is not optional. The two shapes
    // need different readers (a JSON-encoded string vs. typed records), which is why this one
    // fact branches instead of going through `pick`.
    meta.toolCalls = readLegacy
      ? normalizeToolCalls(context?.toolCalls)
      : parseAttributeToolCalls(attributes[NOTIFICATION_ATTR.toolCalls]);
  }

  return {
    id: node.id,
    type: contextTypeLabel(notificationType),
    title: stripNotificationMarkup(node.title),
    description: node.description == null ? undefined : stripNotificationMarkup(node.description),
    createdAt: parseCreatedAt(node.createdAt),
    read: node.read,
    severity,
    variant: severityToVariant(severity),
    category: node.category ?? undefined,
    meta,
  };
}
