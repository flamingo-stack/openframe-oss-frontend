'use client';

import { ChatInput } from '@flamingo-stack/openframe-frontend-core';
import type { ComponentProps } from 'react';
import { ReplyChannelBar } from './reply-channel-bar';
import type { ReplyChannels } from './reply-channels';

type ChatInputProps = ComponentProps<typeof ChatInput>;

interface EmailReplyComposerProps extends Pick<ChatInputProps, 'appearance' | 'onSend' | 'sending'> {
  /** Null while the ticket's email side is read: the line holds its place and the composer stays locked. */
  channels: ReplyChannels | null;
  /** The ticket itself is still read. */
  loading: boolean;
}

/**
 * A ticket's composer where email-to-ticket is on (Figma tickets 9355-67458): the line saying where a reply goes over
 * the input, in one frame. A reply that can reach no one locks it, and so does one not known yet.
 */
export function EmailReplyComposer({ channels, loading, appearance, onSend, sending }: EmailReplyComposerProps) {
  const reachable = !!channels?.chat.available;
  return (
    <div className="mt-[var(--spacing-system-xsf)] overflow-hidden rounded-lg border border-ods-border bg-ods-card focus-within:border-ods-accent">
      <ReplyChannelBar channels={channels} />
      <ChatInput
        appearance={appearance}
        placeholder="Write your reply..."
        disabled={loading || !reachable}
        disabledPlaceholder={channels && !reachable ? 'Replies are not available' : 'Write your reply...'}
        onSend={onSend}
        sending={sending}
        autoFocus={false}
        hideBorder
        className="!max-w-full"
      />
    </div>
  );
}
