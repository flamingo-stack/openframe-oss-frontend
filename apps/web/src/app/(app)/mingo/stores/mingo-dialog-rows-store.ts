import type { MingoDialogNode } from '@flamingo-stack/openframe-frontend-core/chat-protocol';
import { create } from 'zustand';
import { type DialogRowState, serverRowState } from '../utils/dialog-row-status';

/**
 * What the chat list's rows hold beside what the lib's list draws: each dialog's state as the server last answered it
 * (its stream, its pending approval and the replies its viewer has not read, for the row status), who owns it, the id
 * the API takes and its creation time.
 *
 * The lib's chat engine owns the list and maps each node to a `DialogItem`, which carries none of these. Every answer
 * of the ai-agent passes through `postMingoGraphql`, which notes the dialog nodes it carries here: a list page, the open
 * dialog's record. The open dialog's own stream is written over its row while it is open (`noteMingoLiveRow`), so a
 * row left mid-answer or with an approval pending keeps its glyph until the server answers otherwise.
 */
export interface MingoDialogRow extends DialogRowState {
  createdAt: string;
  /** The Relay id: what a mutation's input takes. The row is keyed on the raw one. */
  nodeId: string;
  /** The admin who started the chat; undefined for a dialog a client owns. */
  ownerUserId?: string;
  /** Replies the viewer has not read. The backend counts them for a Mingo chat's owner only. */
  unread: number;
  /** When the viewer last marked the chat read here (`nextMingoRowsTick`): an answer asked before it is stale. */
  readAt?: number;
}

interface MingoDialogRowsState {
  rows: ReadonlyMap<string, MingoDialogRow>;
  /** Dialogs whose record answered that they do not exist for this viewer. */
  missing: ReadonlySet<string>;
}

export const useMingoDialogRowsStore = create<MingoDialogRowsState>()(() => ({
  rows: new Map(),
  missing: new Set(),
}));

let rowsTick = 0;

/**
 * The next moment of the rows' own clock. A request takes one as it is sent and a read mark as it is made, so an
 * answer can be told from one asked before the mark: wall time would tie within a millisecond.
 */
export function nextMingoRowsTick(): number {
  rowsTick += 1;
  return rowsTick;
}

/**
 * The unread replies a node answers. Kept as they were when its query did not select them, and when it was asked
 * before the viewer's last read mark: that answer is older than the mark, and taken it would put the glyph back on a
 * chat the viewer has just read.
 */
function unreadOf(node: MingoDialogNode, known: MingoDialogRow | undefined, askedAt: number | undefined): number {
  if (!('unreadMessageCount' in node)) return known?.unread ?? 0;
  if (known?.readAt !== undefined && (askedAt === undefined || askedAt < known.readAt)) return known.unread;
  return node.unreadMessageCount ?? 0;
}

/**
 * The row a node answers. A field the node's query did not select keeps the row as it was: the open dialog's record does
 * not select `pendingApproval`, and read as "none" it wiped the approval glyph a list page had just set.
 */
function rowOf(node: MingoDialogNode, known: MingoDialogRow | undefined, askedAt: number | undefined): MingoDialogRow {
  const answered = serverRowState(node);
  const ownerUserId = 'owner' in node ? (node.owner?.userId ?? undefined) : known?.ownerUserId;
  return {
    streaming: 'streamState' in node || !known ? answered.streaming : known.streaming,
    ...('pendingApproval' in node || !known
      ? { awaitingApproval: answered.awaitingApproval, approvalRequestId: answered.approvalRequestId }
      : { awaitingApproval: known.awaitingApproval, approvalRequestId: known.approvalRequestId }),
    createdAt: node.createdAt,
    nodeId: node.id,
    ...(ownerUserId ? { ownerUserId } : {}),
    unread: unreadOf(node, known, askedAt),
    ...(known?.readAt !== undefined ? { readAt: known.readAt } : {}),
  };
}

function sameRow(a: MingoDialogRow | undefined, b: MingoDialogRow): boolean {
  return (
    a !== undefined &&
    a.createdAt === b.createdAt &&
    a.streaming === b.streaming &&
    a.awaitingApproval === b.awaitingApproval &&
    a.approvalRequestId === b.approvalRequestId &&
    a.nodeId === b.nodeId &&
    a.ownerUserId === b.ownerUserId &&
    a.unread === b.unread &&
    a.readAt === b.readAt
  );
}

/** The dialog nodes one ai-agent answer carries: a list page's edges, a dialog's record. */
function dialogNodesOf(data: unknown): MingoDialogNode[] {
  if (!data || typeof data !== 'object') return [];
  const { dialogs, dialog } = data as {
    dialogs?: { edges?: Array<{ node?: MingoDialogNode | null }> } | null;
    dialog?: MingoDialogNode | null;
  };
  const nodes = (dialogs?.edges ?? []).flatMap(edge => (edge.node ? [edge.node] : []));
  if (dialog?.dialogId) nodes.push(dialog);
  return nodes;
}

/**
 * Note the dialog nodes an ai-agent answer carries. Unchanged rows keep their objects. `askedAt` is the moment the
 * request was sent (`nextMingoRowsTick`); without it the answer counts as older than any read mark.
 */
export function noteMingoDialogResponse(data: unknown, askedAt?: number): void {
  const nodes = dialogNodesOf(data).filter(node => node.dialogId && node.createdAt);
  if (nodes.length === 0) return;
  useMingoDialogRowsStore.setState(state => {
    let rows: Map<string, MingoDialogRow> | null = null;
    let missing: Set<string> | null = null;
    for (const node of nodes) {
      const known = state.rows.get(node.dialogId);
      const row = rowOf(node, known, askedAt);
      if (!sameRow(known, row)) {
        rows ??= new Map(state.rows);
        rows.set(node.dialogId, row);
      }
      if (state.missing.has(node.dialogId)) {
        missing ??= new Set(state.missing);
        missing.delete(node.dialogId);
      }
    }
    return { ...(rows ? { rows } : {}), ...(missing ? { missing } : {}) };
  });
}

/** The open dialog's record answered that it does not exist for this viewer. */
export function noteMingoDialogMissing(dialogId: string): void {
  useMingoDialogRowsStore.setState(state =>
    state.missing.has(dialogId) ? state : { missing: new Set(state.missing).add(dialogId) },
  );
}

/**
 * The viewer read the chat: its row holds `unread` replies from now on, and every answer asked before this moment
 * is too old to say otherwise.
 */
export function noteMingoDialogRead(dialogId: string, unread: number): void {
  const readAt = nextMingoRowsTick();
  useMingoDialogRowsStore.setState(state => {
    const row = state.rows.get(dialogId);
    return row ? { rows: new Map(state.rows).set(dialogId, { ...row, unread, readAt }) } : state;
  });
}

/** The open dialog's own stream, written over its row. */
export function noteMingoLiveRow(dialogId: string, live: DialogRowState): void {
  useMingoDialogRowsStore.setState(state => {
    const row = state.rows.get(dialogId);
    if (!row) return state;
    const next = { ...row, ...live };
    return sameRow(row, next) ? state : { rows: new Map(state.rows).set(dialogId, next) };
  });
}

/** An approval decided anywhere: no row waits on it any more. */
export function settleMingoRowApproval(approvalRequestId: string): void {
  useMingoDialogRowsStore.setState(state => {
    let rows: Map<string, MingoDialogRow> | null = null;
    for (const [dialogId, row] of state.rows) {
      if (row.approvalRequestId !== approvalRequestId) continue;
      rows ??= new Map(state.rows);
      rows.set(dialogId, { ...row, awaitingApproval: false, approvalRequestId: undefined });
    }
    return rows ? { rows } : state;
  });
}
