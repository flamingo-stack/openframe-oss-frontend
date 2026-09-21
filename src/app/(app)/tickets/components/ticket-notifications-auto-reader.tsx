'use client';

import { type InfiniteData, type QueryClient, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useFeatureFlag } from '@/app/hooks/use-feature-flag';
import { NotificationEntityType } from '@/generated/schema-enums';
import { useMarkEntityNotificationsRead } from '@/graphql/notifications/use-mark-entity-notifications-read';
import { registerActiveDialogView } from '@/lib/active-dialog-views';
import { ATTENTION_IDLE_MS, isSessionActive, subscribeSessionActivity } from '@/lib/session-activity';
import type { TicketsPage } from '../services/ticket-service.types';
import { dialogsQueryKeys } from '../utils/query-keys';

/**
 * Zero the ticket's badge in every cached board column and table page.
 *
 * Written rather than invalidated: invalidation only marks those queries stale while they
 * are unmounted behind this page, so navigating back paints the cached pages and the card
 * kept its badge until the column's 15s poll. The count is known to be zero here.
 *
 * `dialogsQueryKeys.all` may match both infinite-query caches (`{ pages: [...] }`) and,
 * on some board surfaces, single-page caches shaped as `{ dialogs: [...] }` directly. Both
 * shapes are handled explicitly below so a mismatch cannot silently leave a stale badge.
 */
function clearCachedUnreadCount(queryClient: QueryClient, ticketId: string): void {
  queryClient.setQueriesData<InfiniteData<TicketsPage> | TicketsPage>({ queryKey: dialogsQueryKeys.all }, prev => {
    if (!prev) return prev;

    if ('pages' in prev) {
      if (!prev.pages?.some(page => page.dialogs.some(d => d.id === ticketId && d.unreadNotificationCount))) {
        return prev;
      }
      return {
        ...prev,
        pages: prev.pages.map(page => ({
          ...page,
          dialogs: page.dialogs.map(d => (d.id === ticketId ? { ...d, unreadNotificationCount: 0 } : d)),
        })),
      };
    }

    if (!prev.dialogs?.some(d => d.id === ticketId && d.unreadNotificationCount)) return prev;
    return {
      ...prev,
      dialogs: prev.dialogs.map(d => (d.id === ticketId ? { ...d, unreadNotificationCount: 0 } : d)),
    };
  });
}

interface TicketNotificationsAutoReaderProps {
  ticketId: string;
  /**
   * The ticket's client-chat dialog id, or null before it resolves. Registered as an
   * active dialog view while the chat is on screen so a live message notification for
   * this dialog is suppressed and auto-read, exactly as the Mingo drawer does for its
   * own dialog — without it the same event pops on the ticket page but not in Mingo.
   */
  dialogId: string | null;
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
export function TicketNotificationsAutoReader({
  ticketId,
  dialogId,
  clientChatOnScreen,
}: TicketNotificationsAutoReaderProps) {
  const queryClient = useQueryClient();
  const markEntityNotificationsRead = useMarkEntityNotificationsRead();

  // While the client chat is the visible pane, mark its dialog an active view so
  // the live-notification pipeline skips the popup and auto-reads a message for it
  // (isWatchingNotificationDialog) — the same suppression the Mingo drawer gets.
  // Gated on the chat being on screen, not on mount: on the Details tab the user is
  // not watching the conversation, so its messages should still alert.
  useEffect(() => {
    if (!clientChatOnScreen || !dialogId) return undefined;
    return registerActiveDialogView(dialogId);
  }, [clientChatOnScreen, dialogId]);
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
    markEntityNotificationsRead(NotificationEntityType.TICKET, ticketId, () =>
      clearCachedUnreadCount(queryClient, ticketId),
    );
  }, [ticketId, clientChatOnScreen, notificationsEnabled, activityEdge, markEntityNotificationsRead, queryClient]);

  return null;
}
