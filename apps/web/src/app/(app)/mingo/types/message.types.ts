import type { MessageData } from '@flamingo-stack/openframe-frontend-core';
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
  errors?: Array<{ message: string }>;
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
