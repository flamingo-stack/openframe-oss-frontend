import {
  approvalIdOfPart,
  approvalStatusOf,
  type ChatMessage,
  isToolPart,
  type MingoDialogNode,
} from '@flamingo-stack/openframe-frontend-core/chat-protocol';
import type { MingoDialogStatus } from '@flamingo-stack/openframe-frontend-core/components/chat';

/** What the status at the end of a chat list row is made of. */
export interface DialogRowState {
  streaming: boolean;
  awaitingApproval: boolean;
  /** The request it waits on, when known. */
  approvalRequestId?: string;
}

/** The row as the list query last saw it. */
export function serverRowState(node: Pick<MingoDialogNode, 'streamState' | 'pendingApproval'>): DialogRowState {
  return {
    streaming: node.streamState === 'STREAMING',
    awaitingApproval: !!node.pendingApproval,
    approvalRequestId: node.pendingApproval?.id,
  };
}

/**
 * The approval the chat waits on: a `pending` approval card (Mingo sends batches,
 * which stay in the thread) whose request no other copy has resolved.
 */
function pendingApprovalIn(messages: readonly ChatMessage[]): { awaiting: boolean; id?: string } {
  const approvals = messages.flatMap(message => message.parts).filter(isToolPart);
  const resolved = new Set(
    approvals
      .filter(part => {
        const status = approvalStatusOf(part);
        return status !== null && status !== 'pending';
      })
      .map(approvalIdOfPart),
  );
  const pending = approvals.find(part => approvalStatusOf(part) === 'pending' && !resolved.has(approvalIdOfPart(part)));
  return pending ? { awaiting: true, id: approvalIdOfPart(pending) } : { awaiting: false };
}

/** The open chat's row, from its own stream: its phase and the approval cards in its thread. */
export function liveRowState(phase: string, messages: readonly ChatMessage[]): DialogRowState {
  const approval = pendingApprovalIn(messages);
  return { streaming: phase !== 'idle', awaitingApproval: approval.awaiting, approvalRequestId: approval.id };
}

/**
 * Working wins: a chat Mingo answers in is not waiting. An unread reply comes last: the dots and the shield say what
 * the chat is doing now, the glyph what it did while nobody looked.
 */
export function dialogRowStatus(state: DialogRowState, unread = false): MingoDialogStatus | undefined {
  if (state.streaming) return 'working';
  if (state.awaitingApproval) return 'approval';
  return unread ? 'unread' : undefined;
}
