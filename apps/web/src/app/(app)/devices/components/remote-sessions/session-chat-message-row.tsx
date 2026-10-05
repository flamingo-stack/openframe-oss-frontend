'use client';

import { SquareAvatar } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { formatTime } from '@/lib/format-date';

interface SessionChatMessageRowProps {
  authorName: string;
  /** The technician's rows carry the avatar and the accent-colored name. */
  isTechnician: boolean;
  avatarUrl?: string;
  /** ISO timestamp. */
  sentAt: string;
  body: string;
}

/**
 * One session-chat message, shared by the transcript and the live panel:
 * the technician's rows carry a 24px avatar and an accent-colored name, the
 * end user's rows a plain grey name; the timestamp sits right-aligned on the
 * name row and the message body follows below.
 *
 * Names are Azeret Mono 18/24 medium in the mockup - a combination the ODS
 * composite utilities don't carry (`text-h5` is the 14px uppercase caption),
 * so the heading family is applied over `text-h4` via the ODS font variable.
 */
export function SessionChatMessageRow({
  authorName,
  isTechnician,
  avatarUrl,
  sentAt,
  body,
}: SessionChatMessageRowProps) {
  return (
    <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
      <div className="flex items-center gap-[var(--spacing-system-xxs)]">
        {isTechnician && (
          <SquareAvatar variant="round" sizePx={24} src={avatarUrl} alt={authorName} className="shrink-0" />
        )}
        <span
          className={cn(
            'min-w-0 flex-1 truncate text-h4 [font-family:var(--font-family-heading)]',
            isTechnician ? 'text-ods-accent' : 'text-ods-text-secondary',
          )}
        >
          {authorName}
        </span>
        <span className="shrink-0 text-ods-text-secondary text-h6">{formatTime(sentAt)}</span>
      </div>
      <p className="whitespace-pre-wrap text-ods-text-primary text-h4">{body}</p>
    </div>
  );
}
