'use client';

import { TextLineSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import {
  ChatOffIcon,
  ChatsIcon,
  QuestionCircleIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { ReplyChannels } from './reply-channels';

/** A channel the composer does not offer: its name, and why on hover or focus. */
function UnavailableChannel({ label, reason }: { label: string; reason: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="flex shrink-0 cursor-default items-center gap-[var(--spacing-system-xxs)] text-ods-text-secondary"
            aria-label={`${label}: ${reason}`}
          >
            {label}
            <QuestionCircleIcon size={16} aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" align="end" className="max-w-xs">
          {reason}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * The line over a ticket's composer (Figma tickets 9355-67458 to 9355-68705): where a reply goes, and the channels it
 * cannot take, each with its reason. Email is never offered yet: the dashboard has no way to send one. Null while the
 * ticket's email side is read: the line holds its place, so the composer does not move when it lands.
 */
export function ReplyChannelBar({ channels }: { channels: ReplyChannels | null }) {
  const chat = channels?.chat.available ?? true;
  const Icon = chat ? ChatsIcon : ChatOffIcon;
  return (
    <div className="flex min-w-0 items-center gap-[var(--spacing-system-xsf)] border-b border-ods-border px-[var(--spacing-system-sf)] py-[var(--spacing-system-xsf)] text-h6">
      <Icon size={16} className="shrink-0 text-ods-text-secondary" aria-hidden />
      {channels ? (
        <>
          <span className="min-w-0 flex-1 truncate text-ods-text-secondary">
            {chat ? "Reply goes to the user's device chat" : 'No reply can reach the requester from here yet'}
          </span>
          {!channels.chat.available && <UnavailableChannel label="Chat unavailable" reason={channels.chat.reason} />}
          <UnavailableChannel label="Email unavailable" reason={channels.email.reason} />
        </>
      ) : (
        <TextLineSkeleton as="span" type="h6" className="w-56" />
      )}
    </div>
  );
}
