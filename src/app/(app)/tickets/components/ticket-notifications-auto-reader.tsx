'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useFeatureFlag } from '@/app/hooks/use-feature-flag';
import { NotificationEntityType } from '@/generated/schema-enums';
import { useMarkEntityNotificationsRead } from '@/graphql/notifications/use-mark-entity-notifications-read';
import { ATTENTION_IDLE_MS, isSessionActive, subscribeSessionActivity } from '@/lib/session-activity';
import { dialogsQueryKeys } from '../utils/query-keys';

interface TicketNotificationsAutoReaderProps {
  ticketId: string;
  /**
   * Whether the ticket's client chat is the pane actually being shown. Derived by
   * `TicketDetailsContent`, which is the only place that knows which of the page's two
   * layouts is mounted and which tab system that layout uses.
   */
  clientChatOnScreen: boolean;
}

/**
 * Marks every notification about one ticket read once its client chat is on screen.
 *
 * Why it is gated on the chat rather than on mount, and why it must not fire unwatched, is
 * the caller contract documented on `useMarkEntityNotificationsRead`. What is specific here:
 *
 * - Renders null and owns its own state, because the session-activity subscription ticks on
 *   every focus/blur and holding it in the page component would re-render both chat lists
 *   and every info section each time the user alt-tabs.
 * - Fires once per ticket per mount, so returning to the chat does not re-invalidate the
 *   board/table lists. Later arrivals are left to `EntityViewAutoReader`, which covers them
 *   because this only fires while the URL carries `tab=chat` — the very param a chat
 *   notification's own route matches on.
 */
export function TicketNotificationsAutoReader({ ticketId, clientChatOnScreen }: TicketNotificationsAutoReaderProps) {
  const queryClient = useQueryClient();
  const markEntityNotificationsRead = useMarkEntityNotificationsRead();
  // Same gate every other consumer of notification data carries (`EntityViewAutoReader`,
  // `UnreadCountsHydrator`): with the flag off nothing renders these counts, and this would
  // otherwise still commit an irreversible cross-device write on every ticket-chat view.
  const notificationsEnabled = useFeatureFlag('notifications');
  const markedReadTicketRef = useRef<string | null>(null);
  const [activityEdge, setActivityEdge] = useState(0);
  useEffect(() => subscribeSessionActivity(() => setActivityEdge(edge => edge + 1)), []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: activityEdge is the re-run trigger, not read in the body.
  useEffect(() => {
    if (!notificationsEnabled || !clientChatOnScreen) return;
    if (markedReadTicketRef.current === ticketId) return;
    if (!isSessionActive({ idleAfterMs: ATTENTION_IDLE_MS })) return;
    markedReadTicketRef.current = ticketId;
    markEntityNotificationsRead(NotificationEntityType.TICKET, ticketId, () => {
      // Clears the `unreadNotificationCount` badge on the board/table: both are unmounted
      // here, so this only marks them stale and they refetch when the user navigates back.
      queryClient.invalidateQueries({ queryKey: dialogsQueryKeys.all });
    });
  }, [ticketId, clientChatOnScreen, notificationsEnabled, activityEdge, markEntityNotificationsRead, queryClient]);

  return null;
}
