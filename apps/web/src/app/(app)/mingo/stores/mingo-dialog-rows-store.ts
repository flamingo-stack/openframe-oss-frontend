import type { MingoDialogNode } from '@flamingo-stack/openframe-frontend-core/chat-protocol';
import { create } from 'zustand';
import { type DialogRowState, serverRowState } from '../utils/dialog-row-status';

/**
 * What the chat list's rows hold beside what the lib's list draws: each dialog's state as the server last answered it
 * (its stream and pending approval, for the row status) and its creation time.
 *
 * The lib's chat engine owns the list and maps each node to a `DialogItem`, which carries none of these. Every answer
 * of the ai-agent passes through `postMingoGraphql`, which notes the dialog nodes it carries here: a list page, the open
 * dialog's record. The open dialog's own stream is written over its row while it is open (`noteMingoLiveRow`), so a
 * row left mid-answer or with an approval pending keeps its glyph until the server answers otherwise.
 */
export interface MingoDialogRow extends DialogRowState {
  createdAt: string;
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

/**
 * The row a node answers. A field the node's query did not select keeps the row as it was: the open dialog's record does
 * not select `pendingApproval`, and read as "none" it wiped the approval glyph a list page had just set.
 */
function rowOf(node: MingoDialogNode, known: MingoDialogRow | undefined): MingoDialogRow {
  const answered = serverRowState(node);
  return {
    streaming: 'streamState' in node || !known ? answered.streaming : known.streaming,
    ...('pendingApproval' in node || !known
      ? { awaitingApproval: answered.awaitingApproval, approvalRequestId: answered.approvalRequestId }
      : { awaitingApproval: known.awaitingApproval, approvalRequestId: known.approvalRequestId }),
    createdAt: node.createdAt,
  };
}

function sameRow(a: MingoDialogRow | undefined, b: MingoDialogRow): boolean {
  return (
    a !== undefined &&
    a.createdAt === b.createdAt &&
    a.streaming === b.streaming &&
    a.awaitingApproval === b.awaitingApproval &&
    a.approvalRequestId === b.approvalRequestId
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

/** Note the dialog nodes an ai-agent answer carries. Unchanged rows keep their objects. */
export function noteMingoDialogResponse(data: unknown): void {
  const nodes = dialogNodesOf(data).filter(node => node.dialogId && node.createdAt);
  if (nodes.length === 0) return;
  useMingoDialogRowsStore.setState(state => {
    let rows: Map<string, MingoDialogRow> | null = null;
    let missing: Set<string> | null = null;
    for (const node of nodes) {
      const known = state.rows.get(node.dialogId);
      const row = rowOf(node, known);
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
