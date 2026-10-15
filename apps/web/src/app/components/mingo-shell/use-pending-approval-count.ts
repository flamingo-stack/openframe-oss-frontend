'use client';

import { useMingoChat } from '@/app/(app)/mingo/providers/mingo-chat-provider';

/**
 * How many chats wait for an approval: the sidebar's "Needs approval" badge.
 *
 * Derived from what the session already loaded — the chat list's rows, each with the
 * status the list already shows (`dialogStatusOf`: the server's `pendingApproval`, and
 * the open chat's own live stream) — so it costs no request of its own. Which also
 * bounds it: only the pages of the list loaded so far, in the scope it is on, and 0
 * while no chat surface runs the state. A count over every approval (tickets, all
 * chats) is the Needs approval page's to define (stream C1).
 */
export function usePendingApprovalCount(): number {
  const { chat } = useMingoChat();
  if (!chat) return 0;
  return chat.state.dialogs.filter(dialog => chat.dialogStatusOf(dialog) === 'approval').length;
}
