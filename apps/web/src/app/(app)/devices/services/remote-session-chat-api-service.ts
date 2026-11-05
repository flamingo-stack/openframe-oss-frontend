import { CHAT_TYPE } from '@flamingo-stack/openframe-frontend-core';
import { type ParticipantLine, participantLinesOfRow } from '@flamingo-stack/openframe-frontend-core/chat-protocol';
import { ticketService } from '@/app/(app)/tickets/services';
import type { DialogHistoryMessage } from '@/lib/dialog-messages-page';
import { REMOTE_SESSION_END_USER_NAME, type RemoteSessionChatMessage } from '../types/remote-session-chat';
import type { IRemoteSessionChatService, RemoteSessionChatHistory } from './remote-session-chat-service';

/**
 * A remote session's chat as a TRANSCRIPT: the session dialog's persisted client-chat lines, for a recording's page.
 * The live chat of a running session is the lib's chat engine (`useRemoteSessionChat`); this reads what it left behind.
 * A line is the lib's one reader (`participantLinesOfRow`); system notices and assistant turns are not people's lines.
 */

const HISTORY_PAGE_SIZE = 50;
const FALLBACK_TECHNICIAN_NAME = 'Technician';

function isPersonLine(line: ParticipantLine): line is ParticipantLine & { author: 'user' | 'technician' } {
  return line.author !== 'system';
}

/** The lines of one persisted message: its people's lines; anything else (system notices, assistant turns) is none. */
function rowsOf(message: DialogHistoryMessage): RemoteSessionChatMessage[] {
  const lines = participantLinesOfRow(message).filter(isPersonLine);
  return lines.map((line, index) => {
    const id = lines.length > 1 ? `${message.id}:${index}` : message.id;
    const authorName = line.author === 'user' ? REMOTE_SESSION_END_USER_NAME : line.name || FALLBACK_TECHNICIAN_NAME;
    return { id, author: line.author, authorName, sentAt: message.createdAt, body: line.text };
  });
}

export class RemoteSessionChatApiService implements IRemoteSessionChatService {
  async history(dialogId: string): Promise<RemoteSessionChatHistory> {
    const page = await ticketService.fetchMessages({
      dialogId,
      chatType: CHAT_TYPE.CLIENT,
      limit: HISTORY_PAGE_SIZE,
    });
    // Pages are newest first.
    return { messages: [...page.messages].reverse().flatMap(rowsOf) };
  }
}

export const remoteSessionChatApiService = new RemoteSessionChatApiService();
