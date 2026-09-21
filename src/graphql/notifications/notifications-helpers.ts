import type { Notification, NotificationVariant } from '@flamingo-stack/openframe-frontend-core';
import { ConnectionHandler, type RecordProxy, type RecordSourceSelectorProxy, readInlineData } from 'relay-runtime';
import type {
  notificationFields_notification$data as NotificationFieldsData,
  notificationFields_notification$key as NotificationFieldsKey,
} from '@/__generated__/notificationFields_notification.graphql';
import type { NotificationSeverity } from '@/generated/schema-enums';
import { NOTIFICATION_ATTR, parseAttributeToolCalls, readNotificationAttributes } from './notification-attributes';
import { notificationFieldsFragment } from './notification-fields';

export {
  isApprovalNotificationType,
  isApprovalResolved,
  MINGO_APPROVAL_REQUEST_TYPE,
  NOTIFICATION_ATTR,
  parseAttributeToolCalls,
  readNotificationAttributes,
  TICKET_APPROVAL_REQUEST_TYPE,
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

/** True when the connection already holds an edge for the node. */
export function connectionHasNode(conn: RecordProxy, nodeId: string): boolean {
  const edges = conn.getLinkedRecords('edges') ?? [];
  return edges.some(edge => edge?.getLinkedRecord('node')?.getDataID() === nodeId);
}

/**
 * Every updater below is idempotent: it may run for the same notification twice — the user's
 * own mutation, then the READ / DELETED event the backend publishes for it, in either order
 * and around the optimistic revert in between. A second pass finds nothing left to flip,
 * remove or count, and inserts no duplicate edge.
 */
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
        // `insertEdgeBefore` does not dedupe, and the edge id is derived from the node's,
        // so a second insert would list the same row twice in history.
        if (connectionHasNode(readConn, id)) continue;
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
    // The record outlives its edges (nothing deletes it from the store), so `read === false`
    // alone would decrement again on the second pass. The bucket mirrors the unread
    // connection: it moves only when an unread edge actually goes.
    let removedUnreadEdge = false;
    for (const pair of pairs) {
      for (const filters of [pair.unread, pair.read]) {
        const conn = ConnectionHandler.getConnection(root, NOTIFICATIONS_CONNECTION_KEY, filters);
        if (!conn) continue;
        const connId = conn.getDataID();
        if (seen.has(connId)) continue;
        seen.add(connId);
        if (!connectionHasNode(conn, id)) continue;
        ConnectionHandler.deleteNode(conn, id);
        if (filters === pair.unread) removedUnreadEdge = true;
      }
    }
    if (wasUnread && removedUnreadEdge) adjustUnreadCount(store, category, -1);
  };
}

export type NotificationReadStateEvent = 'READ' | 'DELETED';

/**
 * Apply a READ / DELETED live event: the recipient's read-state changed elsewhere (another
 * tab, another device, or this tab's own mutation echoing back), and the event carries the
 * ids only — the cards are already in the store, so each is flipped or dropped in place.
 * An id the store never loaded is skipped, which is why the caller still refetches the
 * counts afterwards.
 */
export function makeReadStateUpdater(
  eventType: NotificationReadStateEvent,
  ids: readonly string[],
  pairs: NotificationConnectionPair[],
) {
  return (store: RecordSourceSelectorProxy) => {
    for (const id of ids) {
      const apply = eventType === 'READ' ? makeMarkReadUpdater(id, pairs) : makeDeleteNotificationUpdater(id, pairs);
      apply(store);
    }
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
 * Human label for a notification `type`: SNAKE_CASE → Title Case
 * (e.g. TICKET_STATUS_CHANGED → "Ticket Status Changed"). Data-driven so new backend
 * types label themselves.
 */
export function notificationTypeLabel(type: string | null | undefined): string | undefined {
  if (!type) return undefined;
  return type
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
 * Reads the `type` + `attributes` contract only. A row carrying neither (nothing the
 * backfill migration has swept) still maps: it keeps its title, body, severity and
 * timestamp, and offers no type or entity metadata — a plain tile, no navigation.
 */
export function mapNotificationNode(node: NotificationFieldsData): Notification {
  const severity = normalizeSeverity(node.severity);
  const attributes = readNotificationAttributes(node.attributes);
  const notificationType = node.type ?? undefined;

  // Entity ids (`ticketId`, `dialogId`) drive navigation and auto-read uniformly across
  // types (see resolveNotificationAction); they sit at fixed keys for every type, known or
  // not, so the spread carries them into `meta` as-is.
  const meta: Record<string, unknown> = {
    // Every attribute the backend sent, including keys this release has no code for.
    ...attributes,
    // The precise backend type — what the core lib's approval gate and the route mapping read.
    notificationType,
  };

  if (attributes[NOTIFICATION_ATTR.approvalRequestId]) {
    // Must end up an ARRAY: the core lib's `getApprovalMeta` bails on anything else, which
    // would silently downgrade the approval tile to a plain one. The spread above put the
    // raw JSON string here, so this assignment is not optional.
    meta.toolCalls = parseAttributeToolCalls(attributes[NOTIFICATION_ATTR.toolCalls]);
  }

  return {
    id: node.id,
    type: notificationTypeLabel(notificationType),
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
