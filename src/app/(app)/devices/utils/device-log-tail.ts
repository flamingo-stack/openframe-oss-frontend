import { ConnectionHandler, type RecordProxy, type RecordSourceProxy } from 'relay-runtime';
import { connectionHasNode } from '@/graphql/notifications/notifications-helpers';
import { isInstantAfter } from './device-log-time';

/** After a failed poll: 15 s, then 30 s until the first success. */
export const BACKOFF_STEPS_MS = [15_000, 30_000] as const;

/** Holds at the last step instead of running off the end of the ladder. */
export function pollBackoffMs(failures: number): number {
  const step = Math.min(Math.max(failures, 0), BACKOFF_STEPS_MS.length - 1);
  return BACKOFF_STEPS_MS[step] ?? BACKOFF_STEPS_MS[BACKOFF_STEPS_MS.length - 1];
}

/** Past this many rows a growing list reloads its head instead: the tail must not grow it for the life of the tab. */
export const DEVICE_LOGS_TAIL_LIMIT = 2_000;

/** How far the client clock may run ahead of the server's before an empty list's poll misses a line. */
export const DEVICE_LOGS_CLOCK_SKEW_MS = 5 * 60 * 1000;

/**
 * Where an empty list's poll starts: its first page already covered the window up
 * to the anchor it was asked at, so the poll only re-reads the skew allowance —
 * never the whole window, and never before the window itself.
 */
export function emptyListPollFrom(anchorMs: number, windowFrom: string | undefined): string {
  const covered = anchorMs - DEVICE_LOGS_CLOCK_SKEW_MS;
  const start = windowFrom === undefined ? Number.NaN : Date.parse(windowFrom);
  return windowFrom !== undefined && start > covered ? windowFrom : new Date(covered).toISOString();
}

/** True once the list holds more rows than the tail may keep. */
export function exceedsTailLimit(store: RecordSourceProxy, connectionId: string): boolean {
  return (store.get(connectionId)?.getLinkedRecords('edges')?.length ?? 0) > DEVICE_LOGS_TAIL_LIMIT;
}

/**
 * The row key: the edge cursor is unique per line within one answer (FE-24) and the
 * tail only adds strictly newer instants, so the pair is unique across the merged
 * list. A reload that writes another line into the same record changes it.
 */
export function deviceLogRowKey(edge: { readonly cursor: string; readonly node: { readonly timestamp: unknown } }) {
  return `${String(edge.node.timestamp)}|${edge.cursor}`;
}

/** One line of a poll answer: its normalized record, edge cursor and instant. */
export interface PolledLine {
  nodeId: string;
  cursor: string;
  timestamp: string;
}

/** A poll answer; `gap` means it filled its page, so lines between it and the list are missing. */
export interface PolledPage {
  gap: boolean;
  lines: readonly PolledLine[];
}

function headTimestamp(connection: RecordProxy): string | null {
  const edges = connection.getLinkedRecords('edges') ?? [];
  const value = edges
    .find(edge => edge)
    ?.getLinkedRecord('node')
    ?.getValue('timestamp');
  return typeof value === 'string' ? value : null;
}

/**
 * Prepends a poll's lines (newest first) to the list's connection. The poll's
 * `from` is inclusive, so lines not strictly newer than the head are already
 * there; a node the connection holds is never inserted twice. Returns the count.
 */
export function prependNewerLines(
  store: RecordSourceProxy,
  connectionId: string,
  lines: readonly PolledLine[],
): number {
  const connection = store.get(connectionId);
  if (!connection) return 0;
  const head = headTimestamp(connection);
  let inserted = 0;
  // Oldest first, each before the current head, so the newest ends on top.
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    const node = store.get(line.nodeId);
    if (!node || (head !== null && !isInstantAfter(line.timestamp, head))) continue;
    if (connectionHasNode(connection, line.nodeId)) continue;
    const edge = ConnectionHandler.createEdge(store, connection, node, 'DeviceLogEdge');
    edge.setValue(line.cursor, 'cursor');
    ConnectionHandler.insertEdgeBefore(connection, edge);
    inserted += 1;
  }
  return inserted;
}
