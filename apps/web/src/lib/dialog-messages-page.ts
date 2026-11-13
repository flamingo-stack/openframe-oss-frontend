import type { HistoricalMessage } from '@flamingo-stack/openframe-frontend-core';
import {
  historicalMessageOfNode,
  MINGO_MESSAGES_QUERY,
  type MingoChatType,
  type MingoMessagesConnection,
  mingoMessagesVariables,
} from '@flamingo-stack/openframe-frontend-core/chat-protocol';
import { apiClient } from '@/lib/api-client';

/**
 * One persisted message as the lib's chat history document answers it (`MINGO_MESSAGES_QUERY`, read back through
 * `historicalMessageOfNode`): the lib's own `HistoricalMessage`, its `parts` included, plus the dialog mode the node
 * carries.
 */
export type DialogHistoryMessage = HistoricalMessage & { dialogMode?: string };

export interface DialogMessagesPage {
  /** Newest first, as the server pages them. */
  messages: DialogHistoryMessage[];
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor?: string;
    endCursor?: string;
  };
}

interface DialogMessagesPageRequest {
  dialogId: string;
  /** Only this chat of the dialog: the operator's Mingo, or the end user's client chat. */
  chatType: MingoChatType;
  cursor?: string;
  limit: number;
}

/**
 * One page of a dialog's persisted messages, read with the lib's one chat history document (the Fae client posts the
 * same one), for the remote-session chat and the compaction watchers. Rejects when the request or any GraphQL field fails: there is one
 * shape, and an error is an error.
 */
export async function fetchDialogMessagesPage({
  dialogId,
  chatType,
  cursor,
  limit,
}: DialogMessagesPageRequest): Promise<DialogMessagesPage> {
  const response = await apiClient.post<{
    data?: { messages?: MingoMessagesConnection | null };
    errors?: Array<{ message: string }>;
  }>('/chat/graphql', {
    query: MINGO_MESSAGES_QUERY,
    variables: mingoMessagesVariables({ dialogId, chatType, cursor, limit }),
  });
  const errors = response.data?.errors;
  if (!response.ok || errors?.length) {
    throw new Error(errors?.[0]?.message || response.error || 'Failed to fetch messages');
  }
  const connection = response.data?.data?.messages;
  if (!connection) return { messages: [], pageInfo: { hasNextPage: false, hasPreviousPage: false } };
  return {
    messages: connection.edges.map(edge => historicalMessageOfNode(edge.node)),
    pageInfo: {
      hasNextPage: connection.pageInfo.hasNextPage,
      hasPreviousPage: connection.pageInfo.hasPreviousPage,
      startCursor: connection.pageInfo.startCursor ?? undefined,
      endCursor: connection.pageInfo.endCursor ?? undefined,
    },
  };
}
