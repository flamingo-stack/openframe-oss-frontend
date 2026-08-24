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
import { notificationFieldsFragment } from './notification-fields';

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

/**
 * Spec-catalog approval types. The backend splits the single legacy approval by ticket
 * linkage, but keeps `context.type` at `ADMIN_APPROVAL_REQUEST` on both — so only the
 * top-level `type` tells them apart.
 */
export const TICKET_APPROVAL_REQUEST_TYPE = 'TICKET_APPROVAL_REQUEST';
export const MINGO_APPROVAL_REQUEST_TYPE = 'MINGO_APPROVAL_REQUEST';

const APPROVAL_TYPES: ReadonlySet<string> = new Set([
  ADMIN_APPROVAL_REQUEST_CONTEXT_TYPE,
  TICKET_APPROVAL_REQUEST_TYPE,
  MINGO_APPROVAL_REQUEST_TYPE,
]);

/**
 * Attribute keys this app reads out of the flat `attributes` map. Every other key the
 * backend sends rides along into `meta` untouched — the catalog adds facts (ticketNumber,
 * actorName, machineId, …) without a client release, and dropping them here would be the
 * one thing that makes that not true.
 */
export const NOTIFICATION_ATTR = {
  ticketId: 'ticketId',
  dialogId: 'dialogId',
  approvalRequestId: 'approvalRequestId',
  approvalType: 'approvalType',
  resolution: 'resolution',
  resolvedByName: 'resolvedByName',
  toolCalls: 'toolCalls',
} as const;

/**
 * Narrow the `attributes` JSON scalar (typed `any` by relay-compiler) to the flat
 * string map the contract promises. Non-string values and empty strings are dropped:
 * the contract says an absent fact is a MISSING KEY, so an empty string would otherwise
 * read as a present-but-blank id and route somewhere that doesn't exist.
 */
export function readNotificationAttributes(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const attributes: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === 'string' && raw !== '') attributes[key] = raw;
  }
  return attributes;
}

/** True for either spec approval type and for the legacy context discriminator. */
export function isApprovalNotificationType(type: string | null | undefined): boolean {
  return !!type && APPROVAL_TYPES.has(type);
}

/**
 * Fold the approval split back onto the legacy discriminator for `meta.contextType`.
 * The core lib gates its approval tile on that exact string and is shared across six
 * projects, so the normalization happens here rather than there. The precise type stays
 * available on `meta.notificationType`.
 */
export function toLegacyContextType(type: string | null | undefined): string | undefined {
  if (!type) return undefined;
  return isApprovalNotificationType(type) ? ADMIN_APPROVAL_REQUEST_CONTEXT_TYPE : type;
}

/**
 * Backend `ApprovalResolution` values that mean the request is settled. PENDING is
 * deliberately NOT one of them.
 *
 * This matters because the two contracts disagree about what an unresolved approval looks
 * like: the legacy context left `resolution` null until the request was settled, while the
 * attribute map carries the key from the start (`PENDING` on a freshly emitted request). A
 * truthiness check was correct for the first and would, on the second, retire every approval
 * to the read list the moment any UPDATED push touched it — the card would vanish from the
 * drawer still awaiting a decision.
 */
const TERMINAL_APPROVAL_RESOLUTIONS: ReadonlySet<string> = new Set(['APPROVED', 'REJECTED', 'CANCELLED']);

export function isApprovalResolved(resolution: unknown): boolean {
  return typeof resolution === 'string' && TERMINAL_APPROVAL_RESOLUTIONS.has(resolution.toUpperCase());
}

function normalizeToolCall(raw: unknown): ApprovalToolCallMeta {
  const call = (raw ?? {}) as Record<string, unknown>;
  return {
    toolExecutionRequestId: typeof call.toolExecutionRequestId === 'string' ? call.toolExecutionRequestId : null,
    toolName: typeof call.toolName === 'string' ? call.toolName : '',
    toolTitle: typeof call.toolTitle === 'string' ? call.toolTitle : null,
    toolExplanation: typeof call.toolExplanation === 'string' ? call.toolExplanation : null,
    toolType: typeof call.toolType === 'string' ? call.toolType : null,
    requiresApproval: Boolean(call.requiresApproval),
    approvalType: typeof call.approvalType === 'string' ? call.approvalType : null,
    toolCallArguments:
      call.toolCallArguments && typeof call.toolCallArguments === 'object'
        ? (call.toolCallArguments as Record<string, unknown>)
        : null,
  };
}

/** Normalize tool calls arriving as objects — the legacy typed context and the legacy NATS payload. */
export function normalizeToolCalls(raw: unknown): ApprovalToolCallMeta[] {
  return Array.isArray(raw) ? raw.map(normalizeToolCall) : [];
}

/**
 * `attributes.toolCalls` is a JSON-encoded array inside a string (every attribute value is
 * a string). Malformed input yields an empty list rather than throwing: a broken tool list
 * must not take the whole notification down with it.
 */
export function parseAttributeToolCalls(raw: string | undefined): ApprovalToolCallMeta[] {
  if (!raw) return [];
  try {
    return normalizeToolCalls(JSON.parse(raw));
  } catch {
    return [];
  }
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
 * Reads the spec contract (`type` + `attributes`) when the row carries it and falls back
 * to the legacy typed `context` when it doesn't. Both are optional on the wire — legacy
 * rows have no `type` until the backfill migration runs, new-path rows may carry no
 * context — and a row with neither still maps, it just offers no navigation.
 */
export function mapNotificationNode(node: NotificationFieldsData): Notification {
  const severity = normalizeSeverity(node.severity);
  const { context } = node;
  const attributes = readNotificationAttributes(node.attributes);
  // The spec type wins; `context.type` is what a legacy row (or a kill-switched backend) has.
  const notificationType = node.type ?? context?.type ?? undefined;

  const meta: Record<string, unknown> = {
    // Every attribute the backend sent, including keys this release has no code for.
    ...attributes,
    notificationType,
    // What the core lib's approval gate reads — the approval split folded back onto one string.
    contextType: toLegacyContextType(notificationType),
  };

  // Entity ids drive navigation and auto-read uniformly across types (see
  // resolveNotificationAction). Under `attributes` they sit at fixed keys for every type,
  // known or not; the context aliases below exist only because the union declares the same
  // field with different nullability per member.
  const ticketId =
    attributes[NOTIFICATION_ATTR.ticketId] ??
    context?.ticketId ??
    context?.approvalTicketId ??
    context?.clientTicketId ??
    undefined;
  const dialogId = attributes[NOTIFICATION_ATTR.dialogId] ?? context?.dialogId ?? undefined;
  if (dialogId) meta.dialogId = dialogId;
  if (ticketId) meta.ticketId = ticketId;

  const approvalRequestId = attributes[NOTIFICATION_ATTR.approvalRequestId] ?? context?.approvalRequestId ?? undefined;
  if (approvalRequestId) {
    meta.approvalRequestId = approvalRequestId;
    meta.approvalType = attributes[NOTIFICATION_ATTR.approvalType] ?? context?.approvalType ?? null;
    meta.resolution = attributes[NOTIFICATION_ATTR.resolution] ?? context?.resolution ?? null;
    meta.resolvedByName = attributes[NOTIFICATION_ATTR.resolvedByName] ?? context?.resolvedByName ?? null;
    // Must end up an ARRAY: the core lib's `getApprovalMeta` bails on anything else, which
    // would silently downgrade the approval tile to a plain one. The spread above put the
    // raw JSON string here, so this assignment is not optional.
    meta.toolCalls =
      attributes[NOTIFICATION_ATTR.toolCalls] !== undefined
        ? parseAttributeToolCalls(attributes[NOTIFICATION_ATTR.toolCalls])
        : normalizeToolCalls(context?.toolCalls);
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
