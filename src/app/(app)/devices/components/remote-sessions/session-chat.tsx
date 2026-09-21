'use client';

import type { RecordingChatMessage, RecordingEmployee } from '../../types/session-recording';
import { SessionChatMessageRow } from './session-chat-message-row';

interface SessionChatProps {
  messages: RecordingChatMessage[];
  employee: RecordingEmployee;
}

/**
 * The read-only SESSION CHAT transcript under the player (Figma 758-46714).
 * Rows are shared with the live session chat panel on the remote-desktop
 * page; here the technician is the recording's employee.
 */
export function SessionChat({ messages, employee }: SessionChatProps) {
  if (messages.length === 0) return null;

  return (
    <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
      <span className="text-ods-text-secondary text-h5">Session Chat</span>
      <div className="flex flex-col gap-[var(--spacing-system-xsf)] rounded-[6px] border border-ods-border bg-ods-card p-[var(--spacing-system-m)]">
        {messages.map(message => (
          <SessionChatMessageRow
            key={message.id}
            authorName={message.author}
            isTechnician={message.author === employee.name}
            avatarUrl={employee.avatarUrl}
            sentAt={message.sentAt}
            body={message.body}
          />
        ))}
      </div>
    </div>
  );
}
