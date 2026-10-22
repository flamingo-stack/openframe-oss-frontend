'use client';

import { RemoteDesktopChatMessageRow } from '@flamingo-stack/openframe-frontend-core/components/features';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { useEffect, useRef } from 'react';
import type { RecordingChatMessage, RecordingEmployee } from '../../types/session-recording';

/** The transcript's height before it scrolls: about the beside-the-player column it was on a desktop. */
const SESSION_CHAT_MAX_HEIGHT = 'max-h-[400px]';

interface SessionChatProps {
  messages: RecordingChatMessage[];
  employee: RecordingEmployee;
  className?: string;
}

/**
 * The read-only SESSION CHAT transcript under the player (Figma 1728-42383 drew it beside; it moved below so a
 * recording with a chat moves nothing on screen when it answers). It scrolls inside past `SESSION_CHAT_MAX_HEIGHT`,
 * opened on the last message.
 * Rows are shared with the live session chat panel on the remote-desktop
 * page; here the technician is the recording's employee.
 */
export function SessionChat({ messages, employee, className }: SessionChatProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // Open on the last message; only when the transcript changes, so reading
  // back up is not undone by the page re-rendering under the player.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  if (messages.length === 0) return null;

  return (
    <div className={cn('flex min-w-0 flex-col gap-[var(--spacing-system-xxs)]', className)}>
      <span className="text-ods-text-secondary text-h5">Session Chat</span>
      <div
        ref={scrollRef}
        className={cn(
          'grid grid-cols-1 content-start gap-[var(--spacing-system-xsf)] overflow-y-auto rounded-[6px] border border-ods-border bg-ods-card p-[var(--spacing-system-m)]',
          SESSION_CHAT_MAX_HEIGHT,
        )}
      >
        {messages.map(message => (
          <RemoteDesktopChatMessageRow
            key={message.id}
            data-loading-item
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
