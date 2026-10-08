'use client';

import { RemoteDesktopChatMessageRow } from '@flamingo-stack/openframe-frontend-core/components/features';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { useEffect, useRef } from 'react';
import type { RecordingChatMessage, RecordingEmployee } from '../../types/session-recording';

interface SessionChatProps {
  messages: RecordingChatMessage[];
  employee: RecordingEmployee;
  className?: string;
}

/**
 * The read-only SESSION CHAT transcript beside the player (Figma 1728-42383).
 * On desktop it is a column as tall as the player and scrolls inside, opened
 * on the last message; below that it stacks under the player at its own height.
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
      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          className="flex flex-col gap-[var(--spacing-system-xsf)] rounded-[6px] border border-ods-border bg-ods-card p-[var(--spacing-system-m)] content-lg:absolute content-lg:inset-0 content-lg:overflow-y-auto"
        >
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
    </div>
  );
}
