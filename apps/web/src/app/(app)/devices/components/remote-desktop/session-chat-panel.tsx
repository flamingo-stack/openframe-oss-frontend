'use client';

import { TextLineSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { ChatInput } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { useEffect, useRef } from 'react';
import { SessionChatMessageRow } from '@/app/(app)/devices/components/remote-sessions/session-chat-message-row';
import type {
  RemoteSessionChatMessage,
  RemoteSessionChatTechnician,
} from '@/app/(app)/devices/types/remote-session-chat';

interface SessionChatPanelProps {
  messages: RemoteSessionChatMessage[];
  /** The dialog's history is still on its way; the empty state must not claim there is nothing. */
  loading?: boolean;
  technician: RemoteSessionChatTechnician;
  sending: boolean;
  /** Resolves `false` to keep the draft in the input (nothing was sent). */
  onSend: (body: string) => Promise<boolean>;
  /**
   * `side` - the right-hand column next to the canvas;
   * `overlay` - floating over the stream in fullscreen, positioned against
   * the fullscreen canvas container.
   */
  variant: 'side' | 'overlay';
}

/**
 * Messages drawn while the dialog's history is read. The history has no page size: a typical session opens with a
 * few lines.
 */
const SESSION_CHAT_SKELETON_MESSAGES = 3;

/** The history while it is read: message rows in `SessionChatMessageRow`'s geometry, name and time over the body. */
function SessionChatHistorySkeleton() {
  return (
    <>
      {Array.from({ length: SESSION_CHAT_SKELETON_MESSAGES }, (_, index) => (
        <div key={index} data-loading-item className="flex flex-col gap-[var(--spacing-system-xxs)]">
          <div className="flex items-center gap-[var(--spacing-system-xxs)]">
            <TextLineSkeleton type="h4" className="w-32" />
            <span className="flex-1" />
            <TextLineSkeleton type="h6" className="w-12" />
          </div>
          <TextLineSkeleton type="h4" className="w-3/4" />
        </div>
      ))}
    </>
  );
}

/**
 * Chat with the end user during a remote session: the message stream
 * bottom-aligned above the composer. The end user's side is the session block
 * in openframe-chat; the "JOINED CHAT" badge is that side's indication only
 * and is not shown here.
 */
export function SessionChatPanel({ messages, loading, technician, sending, onSend, variant }: SessionChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // The page is loading (its scope), or the dialog's history is.
  const historyLoading = useLoadingScope() || Boolean(loading);

  // Keep the newest message in view as the stream grows.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  return (
    <aside
      aria-label="Session chat"
      className={cn(
        'flex flex-col gap-[var(--spacing-system-mf)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-mf)]',
        variant === 'side'
          ? 'h-full w-[400px] flex-shrink-0'
          : 'absolute bottom-[var(--spacing-system-mf)] right-[var(--spacing-system-mf)] top-[calc(var(--spacing-system-xlf)+var(--spacing-system-mf))] z-10 w-[360px] shadow-lg',
      )}
    >
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex min-h-full flex-col justify-end gap-[var(--spacing-system-xsf)]">
          {messages.length === 0 && historyLoading ? (
            <SessionChatHistorySkeleton />
          ) : messages.length === 0 ? (
            <p className="text-center text-ods-text-muted text-h6">No messages yet - say hello to the user.</p>
          ) : (
            messages.map(message => (
              <SessionChatMessageRow
                key={message.id}
                authorName={message.authorName}
                isTechnician={message.author === 'technician'}
                avatarUrl={message.author === 'technician' ? technician.avatarUrl : undefined}
                sentAt={message.sentAt}
                body={message.body}
              />
            ))
          )}
        </div>
      </div>

      <ChatInput
        placeholder="Enter your Message..."
        onSend={onSend}
        sending={sending}
        showSendButton
        fullWidth
        maxRows={4}
      />
    </aside>
  );
}
