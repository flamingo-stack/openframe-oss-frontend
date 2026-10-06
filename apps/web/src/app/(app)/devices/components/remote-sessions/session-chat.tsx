'use client';

import { RemoteDesktopChatMessageRow } from '@flamingo-stack/openframe-frontend-core/components/features';
import type { RecordingChatMessage, RecordingEmployee } from '../../types/session-recording';

interface SessionChatProps {
  messages: RecordingChatMessage[];
  employee: RecordingEmployee;
}

/**
 * The read-only SESSION CHAT transcript under the player.
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
          <RemoteDesktopChatMessageRow
            key={message.id}
            authorName={message.author}
            isTechnician={message.fromTechnician}
            avatarUrl={employee.avatarUrl}
            sentAt={message.sentAt}
            body={message.body}
          />
        ))}
      </div>
    </div>
  );
}
