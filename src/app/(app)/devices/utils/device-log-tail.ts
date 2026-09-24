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
