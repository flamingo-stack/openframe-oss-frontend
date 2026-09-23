import { CHAT_TYPE, type ChunkData, OWNER_TYPE } from '@flamingo-stack/openframe-frontend-core';
import { decodeNatsChunk } from '@flamingo-stack/openframe-frontend-core/chat-protocol';
import { ticketService } from '@/app/(app)/tickets/services';
import type { AdminOwner, Message } from '@/app/(app)/tickets/types/dialog.types';
import {
  REMOTE_SESSION_END_USER_NAME,
  type RemoteSessionChatMessage,
  type RemoteSessionChatTechnician,
} from '../types/remote-session-chat';
import type { IRemoteSessionChatService, RemoteSessionChatHistory } from './remote-session-chat-service';

/**
 * The session dialog the backend provisions with a remote session: a
 * DIRECT-mode client-chat dialog whose id rides in the session record. The
 * technician reads it and writes to it the way the ticket chat does - history
 * through `messages(dialogId, chatType: CLIENT_CHAT)` on the chat service,
 * sends through its messages endpoint - and the live feed is the dialog's
 * JetStream subject, decoded here (`decodeRemoteSessionChatChunk`) and
 * subscribed by the hook. A technician's own line comes back as the ADMIN-owned
 * echo, so nothing is shown until the dialog has it; the end user's lines are
 * CLIENT-owned; system notices are the client-chat indicator and are dropped.
 */

const HISTORY_PAGE_SIZE = 50;
const TEXT_ROW = 'TEXT';
const FALLBACK_TECHNICIAN_NAME = 'Technician';

function technicianName(owner: Message['owner']): string {
  const user = (owner as AdminOwner).user;
  return [user?.firstName, user?.lastName].filter(Boolean).join(' ') || FALLBACK_TECHNICIAN_NAME;
}

/** The rows of one persisted message: TEXT by owner; anything else (system notices, assistant turns) is not a chat line. */
function rowsOf(message: Message): RemoteSessionChatMessage[] {
  const data = message.messageData;
  const items = Array.isArray(data) ? data : data ? [data] : [];
  const seq = typeof message.lastChunkStreamSeq === 'number' ? message.lastChunkStreamSeq : undefined;
  const rows: RemoteSessionChatMessage[] = [];
  items.forEach((item, index) => {
    const text = (item as { type?: string; text?: string }).text;
    if (item.type !== TEXT_ROW || !text) return;
    const id = items.length > 1 ? `${message.id}:${index}` : message.id;
    if (message.owner?.type === OWNER_TYPE.CLIENT) {
      rows.push({
        id,
        author: 'user',
        authorName: REMOTE_SESSION_END_USER_NAME,
        sentAt: message.createdAt,
        body: text,
        seq,
      });
    } else if (message.owner?.type === OWNER_TYPE.ADMIN) {
      rows.push({
        id,
        author: 'technician',
        authorName: technicianName(message.owner),
        sentAt: message.createdAt,
        body: text,
        seq,
      });
    }
  });
  return rows;
}

let liveRowCounter = 0;

/**
 * A live chunk of the session dialog as a chat row, or null for anything that
 * is not a participant's line (deltas of an assistant turn, system notices,
 * malformed chunks). `technician` names an ADMIN echo that carries no display name.
 */
export function decodeRemoteSessionChatChunk(
  payload: unknown,
  technician?: RemoteSessionChatTechnician,
): RemoteSessionChatMessage | null {
  const event = decodeNatsChunk(payload);
  if (!event || event.type !== 'participant' || event.kind === 'system' || !event.text) return null;
  const streamSeq = (payload as ChunkData).streamSeq;
  const seq = typeof streamSeq === 'number' && streamSeq > 0 ? streamSeq : undefined;
  const id = seq !== undefined ? `seq-${seq}` : `live-${++liveRowCounter}`;
  const sentAt = new Date().toISOString();
  if (event.ownerType === OWNER_TYPE.CLIENT) {
    return { id, author: 'user', authorName: REMOTE_SESSION_END_USER_NAME, sentAt, body: event.text, seq };
  }
  if (event.ownerType === OWNER_TYPE.ADMIN) {
    return {
      id,
      author: 'technician',
      authorName: event.displayName || technician?.name || FALLBACK_TECHNICIAN_NAME,
      sentAt,
      body: event.text,
      seq,
    };
  }
  return null;
}

export class RemoteSessionChatApiService implements IRemoteSessionChatService {
  async history(dialogId: string): Promise<RemoteSessionChatHistory> {
    const page = await ticketService.fetchMessages({
      dialogId,
      chatType: CHAT_TYPE.CLIENT,
      limit: HISTORY_PAGE_SIZE,
      sortField: 'createdAt',
      sortDirection: 'DESC',
    });
    // Pages are newest first.
    const messages = [...page.messages].reverse().flatMap(rowsOf);
    const lastSeq = messages.reduce((max, row) => Math.max(max, row.seq ?? 0), 0);
    return { messages, lastSeq };
  }

  async send(dialogId: string, body: string): Promise<void> {
    await ticketService.sendMessage(dialogId, body, CHAT_TYPE.CLIENT);
  }
}

export const remoteSessionChatApiService = new RemoteSessionChatApiService();
