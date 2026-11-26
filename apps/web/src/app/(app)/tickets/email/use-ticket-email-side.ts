'use client';

import { useFeatureFlagGate } from '@/app/hooks/use-feature-flag';
import type { FeatureFlagGate } from '@/lib/feature-flags';
import { type ReplyChannels, replyChannelsOf } from './reply-channels';
import { type TicketEmailRows, ticketEmailRows } from './ticket-email-rows';
import { useTicketEmail } from './use-ticket-email';

export interface TicketEmailSide {
  /** The `email-to-ticket` flag: the ticket page holds what depends on it until it answers. */
  gate: FeatureFlagGate;
  /** The matched person's name, for the end user's chat messages. */
  requesterName: string | undefined;
  rows: TicketEmailRows;
  /** Where a reply can go; null while the email side is read. */
  replyChannels: ReplyChannels | null;
}

/**
 * A ticket's email side (email-to-ticket, contract part C), read only where the backend serves it, which the flag says:
 * its rows in Ticket Details, the person it was matched to and the channels a reply can take.
 */
export function useTicketEmailSide(ticketId: string, { closed }: { closed: boolean }): TicketEmailSide {
  const gate = useFeatureFlagGate('email-to-ticket');
  const { data } = useTicketEmail(ticketId, { enabled: gate === 'on' });
  const email = gate === 'on' ? (data ?? null) : null;
  return {
    gate,
    requesterName: email?.requester?.name || undefined,
    rows: ticketEmailRows(email),
    replyChannels: email ? replyChannelsOf(email, closed) : null,
  };
}
