import type {
  Message,
  MessageSegment,
  MingoDialogStatus,
} from '@flamingo-stack/openframe-frontend-core/components/chat';
import type { InfiniteData } from '@tanstack/react-query';
import type { DialogNode } from '../types';

/** What the status at the end of a chat list row is made of. */
export interface DialogRowState {
  streaming: boolean;
  awaitingApproval: boolean;
  /** The request it waits on, when known. */
  approvalRequestId?: string;
}

/** One page of the chat list query (`mingoDialogQueryKeys.list`). */
export interface MingoDialogsPage {
  dialogs: DialogNode[];
  pageInfo: { hasNextPage: boolean; endCursor?: string };
}

/** The row as the list query last saw it. */
export function serverRowState(node: Pick<DialogNode, 'streamState' | 'pendingApproval'>): DialogRowState {
  return {
    streaming: node.streamState === 'STREAMING',
    awaitingApproval: !!node.pendingApproval,
    approvalRequestId: node.pendingApproval?.id,
  };
}

function approvalIdOf(segment: MessageSegment): string | undefined {
  if (segment.type === 'approval_request') return segment.data.requestId ?? segment.data.approvalRequestId;
  if (segment.type === 'approval_batch') return segment.data.approvalRequestId;
  return undefined;
}

/**
 * The approval the chat waits on: a `pending` approval card (Mingo sends batches,
 * which stay in the thread) whose request no other copy has resolved.
 */
function pendingApprovalIn(messages: readonly Message[]): { awaiting: boolean; id?: string } {
  const segments = messages.flatMap(message => (Array.isArray(message.content) ? message.content : []));
  const approvals = segments.filter(
    segment => segment.type === 'approval_request' || segment.type === 'approval_batch',
  );
  const resolved = new Set(
    approvals.filter(segment => segment.status && segment.status !== 'pending').map(approvalIdOf),
  );
  const pending = approvals.find(segment => segment.status === 'pending' && !resolved.has(approvalIdOf(segment)));
  return pending ? { awaiting: true, id: approvalIdOf(pending) } : { awaiting: false };
}

/** The open chat's row, from its own stream: its phase and the approval cards in its thread. */
export function liveRowState(phase: string, messages: readonly Message[]): DialogRowState {
  const approval = pendingApprovalIn(messages);
  return { streaming: phase !== 'idle', awaitingApproval: approval.awaiting, approvalRequestId: approval.id };
}

/** Working wins: a chat Mingo answers in is not waiting. No status leaves the lib to show unread replies. */
export function dialogRowStatus(state: DialogRowState): MingoDialogStatus | undefined {
  if (state.streaming) return 'working';
  if (state.awaitingApproval) return 'approval';
  return undefined;
}

function livePendingApproval(node: DialogNode, live: DialogRowState): DialogNode['pendingApproval'] {
  if (!live.awaitingApproval) return null;
  if (node.pendingApproval && (!live.approvalRequestId || node.pendingApproval.id === live.approvalRequestId)) {
    return node.pendingApproval;
  }
  return live.approvalRequestId ? { id: live.approvalRequestId } : node.pendingApproval;
}

/**
 * The list pages with the open chat's live state written onto its row, so the row
 * keeps it once another chat opens instead of waiting for the next poll.
 * Unchanged pages come back by reference.
 */
export function withLiveRowState(
  data: InfiniteData<MingoDialogsPage> | undefined,
  dialogId: string,
  live: DialogRowState,
): InfiniteData<MingoDialogsPage> | undefined {
  if (!data) return data;
  let changed = false;
  const pages = data.pages.map(page => {
    const index = page.dialogs.findIndex(node => node.dialogId === dialogId);
    if (index === -1) return page;
    const node = page.dialogs[index];
    const streamState = live.streaming ? 'STREAMING' : 'IDLE';
    const pendingApproval = livePendingApproval(node, live);
    if (node.streamState === streamState && (node.pendingApproval ?? null) === (pendingApproval ?? null)) return page;
    changed = true;
    const dialogs = [...page.dialogs];
    dialogs[index] = { ...node, streamState, pendingApproval };
    return { ...page, dialogs };
  });
  return changed ? { ...data, pages } : data;
}
