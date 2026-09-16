'use client';

import { SquareAvatar } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import type { RecordingChatMessage, RecordingEmployee } from '../../types/session-recording';

function formatChatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

interface SessionChatProps {
  messages: RecordingChatMessage[];
  employee: RecordingEmployee;
}

/**
 * The read-only SESSION CHAT transcript under the player (Figma 758-46714):
 * the technician's rows carry a 24px avatar and an accent-colored name, the
 * end user's rows a plain grey name; the timestamp sits right-aligned on the
 * name row and the message body follows below.
 *
 * Names are Azeret Mono 18/24 medium in the mockup - a combination the ODS
 * composite utilities don't carry (`text-h5` is the 14px uppercase caption),
 * so the heading family is applied over `text-h4` via the ODS font variable.
 */
export function SessionChat({ messages, employee }: SessionChatProps) {
  if (messages.length === 0) return null;

  return (
    <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
      <span className="text-ods-text-secondary text-h5">Session Chat</span>
      <div className="flex flex-col gap-[var(--spacing-system-xsf)] rounded-[6px] border border-ods-border bg-ods-card p-[var(--spacing-system-m)]">
        {messages.map(message => {
          const isEmployee = message.author === employee.name;
          return (
            <div key={message.id} className="flex flex-col gap-[var(--spacing-system-xxs)]">
              <div className="flex items-center gap-[var(--spacing-system-xxs)]">
                {isEmployee && (
                  <SquareAvatar
                    variant="round"
                    sizePx={24}
                    src={employee.avatarUrl}
                    alt={employee.name}
                    className="shrink-0"
                  />
                )}
                <span
                  className={cn(
                    'min-w-0 flex-1 truncate text-h4 [font-family:var(--font-family-heading)]',
                    isEmployee ? 'text-ods-accent' : 'text-ods-text-secondary',
                  )}
                >
                  {message.author}
                </span>
                <span className="shrink-0 text-ods-text-secondary text-h6">{formatChatTime(message.sentAt)}</span>
              </div>
              <p className="whitespace-pre-wrap text-ods-text-primary text-h4">{message.body}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
