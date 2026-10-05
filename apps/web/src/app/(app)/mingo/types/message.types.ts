import type { Message as LibMessage, MessageData } from '@flamingo-stack/openframe-frontend-core';
import type { ChatType, OwnerType } from '../../tickets/constants';

export interface GraphQlMessage {
  id: string;
  dialogId: string;
  chatType: ChatType;
  dialogMode: string;
  createdAt: string;
  lastChunkStreamSeq?: number | null;
  owner: {
    type: OwnerType;
    model?: string;
  };
  /**
   * The per-message payload as the chat service sends it — one shape per message
   * type, single or batched. Typed as the library's own `MessageData` union, the
   * same one `HistoricalMessage` carries, so the two stay in step; readers narrow
   * on `type` (see the approval-result branch in `use-mingo-dialog-selection`).
   */
  messageData: MessageData | MessageData[];
}

/**
 * THE lib `Message`, not a copy of it. This used to be a hand-rolled,
 * slightly-narrower re-declaration (no `chatRefs` / `scrollAnchor` /
 * `hidden`), which made every mirror seam — where the shared
 * `createReducerMirror` hands back lib-shaped rows — need a cast, plus a
 * wrapper whose only job was performing one. Aliasing keeps the mingo-facing
 * name while making the two shapes the SAME type by construction.
 */
export type CoreMessage = LibMessage;

export type Message = CoreMessage;

export interface MessageConnection {
  edges: Array<{
    cursor: string;
    node: GraphQlMessage;
  }>;
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor?: string;
    endCursor?: string;
  };
}

export interface MessagesResponse {
  data: {
    messages: MessageConnection;
  };
}

export interface MessagePage {
  messages: GraphQlMessage[];
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor?: string;
    endCursor?: string;
  };
}

export function isGraphQlMessage(message: object): message is GraphQlMessage {
  return 'messageData' in message;
}

export function isCoreMessage(message: object): message is CoreMessage {
  return 'content' in message;
}
