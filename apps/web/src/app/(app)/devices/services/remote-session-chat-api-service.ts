import { CHAT_TYPE } from '@flamingo-stack/openframe-frontend-core';
import {
  type ParticipantLine,
  participantLineOf,
  participantLinesOfRow,
} from '@flamingo-stack/openframe-frontend-core/chat-protocol';
import { ticketService } from '@/app/(app)/tickets/services';
import type { Message } from '@/app/(app)/tickets/types/dialog.types';
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
 * JetStream subject, read here (`decodeRemoteSessionChatChunk`) and
 * subscribed by the hook. A line, live or persisted, is the lib's one reader
 * (`participantLineOf`, `participantLinesOfRow`). A technician's own line comes
 * back as the ADMIN-owned echo, so nothing is shown until the dialog has it; the
 * end user's lines are CLIENT-owned; system notices are the client-chat
 * indicator and are dropped.
 */

const HISTORY_PAGE_SIZE = 50;
const FALLBACK_TECHNICIAN_NAME = 'Technician';

/** A person's line as this feed's row, or null for a notice of the system. */
function rowOf(
  line: ParticipantLine,
  at: { id: string; sentAt: string },
  technician?: RemoteSessionChatTechnician,
): RemoteSessionChatMessage | null {
  if (line.author === 'system') return null;
  const authorName =
    line.author === 'user' ? REMOTE_SESSION_END_USER_NAME : line.name || technician?.name || FALLBACK_TECHNICIAN_NAME;
  return { ...at, author: line.author, authorName, body: line.text, seq: line.seq };
}

/** The rows of one persisted message: its people's lines; anything else (system notices, assistant turns) is none. */
function rowsOf(message: Message): RemoteSessionChatMessage[] {
  const lines = participantLinesOfRow(message).filter(line => line.author !== 'system');
  return lines.flatMap((line, index) => {
    const id = lines.length > 1 ? `${message.id}:${index}` : message.id;
    const row = rowOf(line, { id, sentAt: message.createdAt });
    return row ? [row] : [];
  });
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
  const line = participantLineOf(payload);
  if (!line) return null;
  // A chunk without a stream sequence gets a local id.
  const id = line.seq !== undefined ? `seq-${line.seq}` : `live-${++liveRowCounter}`;
  return rowOf(line, { id, sentAt: new Date().toISOString() }, technician);
}

export class RemoteSessionChatApiService implements IRemoteSessionChatService {
  async history(dialogId: string): Promise<RemoteSessionChatHistory> {
    const page = await ticketService.fetchMessages({
      dialogId,
      chatType: CHAT_TYPE.CLIENT,
      limit: HISTORY_PAGE_SIZE,
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
