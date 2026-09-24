'use client';

import { useEffect, useRef, useState } from 'react';
import { useFeatureFlag } from '@/app/hooks/use-feature-flag';
import { NotificationEntityType } from '@/generated/schema-enums';
import { useMarkEntityNotificationsRead } from '@/graphql/notifications/use-mark-entity-notifications-read';
import { registerActiveDialogView } from '@/lib/active-dialog-views';
import { ATTENTION_IDLE_MS, isSessionActive, subscribeAttention } from '@/lib/session-activity';
import { useMarkDialogMessagesRead } from '../hooks/use-mark-dialog-messages-read';

interface TicketNotificationsAutoReaderProps {
  ticketId: string;
  /**
   * The ticket's client-chat dialog id, or null before it resolves. Registered as an
   * active dialog view while the chat is on screen so a live message notification for
   * this dialog is suppressed and auto-read, exactly as the Mingo drawer does for its
   * own dialog — without it the same event pops on the ticket page but not in Mingo.
   * Also the id the shared message counter is reset on.
   */
  dialogId: string | null;
  /**
   * Whether the ticket's client chat is the pane actually being shown. Derived by
   * `TicketDetailsContent`, which is the only place that knows which of the page's two
   * layouts is mounted and which tab system that layout uses.
   */
  clientChatOnScreen: boolean;
  /**
   * Id of the newest END-USER row the client chat shows (`lastClientMessageId`), or
   * null while none is loaded. Every new value is a client message the technician now
   * has in front of them - loaded with the history or arrived live - and is what
   * re-arms the message read mark. Technician and assistant rows do not move it.
   */
  lastClientMessageId: string | null;
}

/**
 * Marks a ticket "read" once its client chat is on screen, on two independent ledgers:
 *
 * 1. The caller's NOTIFICATIONS about the ticket (`markNotificationsReadForEntity`):
 *    per user; feeds the bell, the drawer and the sidebar count. Why it is gated on the
 *    chat rather than on mount, and why it must not fire unwatched, is the caller
 *    contract documented on `useMarkEntityNotificationsRead`. Fires once per ticket per
 *    mount, so returning to the chat does not re-invalidate the lists; later arrivals
 *    are left to `EntityViewAutoReader`, which covers them because this only fires
 *    while the URL carries `tab=chat` — the very param a chat notification's own route
 *    matches on.
 * 2. The dialog's unread client MESSAGES (`markDialogMessagesRead`): ONE counter shared
 *    by every technician, feeding the board card's "New Message" tag and the table's
 *    count. Fires once per client message the chat shows while attended, so the badge a
 *    ticket carries drops for all technicians as soon as one of them has read it, and
 *    a message arriving while the chat is open does not leave a badge behind.
 *
 * Both are gated on the chat being the visible pane (on the Details tab the user is not
 * watching the conversation) and on an attended session (`isSessionActive` at the
 * attention window, re-checked on every `subscribeAttention` edge), so a tab the browser
 * restored with nobody at the desk marks nothing. Only (1) rides the `notifications`
 * flag: the message counter is unflagged on the ai-agent and the board renders it
 * regardless.
 *
 * Renders null and owns its own state, because the attention subscription ticks on every
 * focus/blur and holding it in the page component would re-render both chat lists and
 * every info section each time the user alt-tabs.
 */
export function TicketNotificationsAutoReader({
  ticketId,
  dialogId,
  clientChatOnScreen,
  lastClientMessageId,
}: TicketNotificationsAutoReaderProps) {
  const markEntityNotificationsRead = useMarkEntityNotificationsRead();
  const markDialogMessagesRead = useMarkDialogMessagesRead();

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
  // Same edge `EntityViewAutoReader` re-runs on: hard focus edges plus input resuming
  // after the attention window, so a ticket opened by a tab restore is read the moment
  // a human provably arrives, not never.
  const [activityEdge, setActivityEdge] = useState(0);
  useEffect(() => subscribeAttention(() => setActivityEdge(edge => edge + 1)), []);

  // activityEdge is the re-run trigger, not read in the body.
  useEffect(() => {
    if (!notificationsEnabled || !clientChatOnScreen) return;
    if (markedReadTicketRef.current === ticketId) return;
    if (!isSessionActive({ idleAfterMs: ATTENTION_IDLE_MS })) return;
    markedReadTicketRef.current = ticketId;
    markEntityNotificationsRead(NotificationEntityType.TICKET, ticketId);
  }, [ticketId, clientChatOnScreen, notificationsEnabled, activityEdge, markEntityNotificationsRead]);

  // Message counter: once per (dialog, newest client message) while attended. An
  // arrival nobody was there for stays armed - the next attention edge re-runs this
  // with the same id and marks it then, the same way (1) catches a restored tab.
  const markedMessageRef = useRef<string | null>(null);
  useEffect(() => {
    if (!clientChatOnScreen || !dialogId || !lastClientMessageId) return;
    const key = `${dialogId}:${lastClientMessageId}`;
    if (markedMessageRef.current === key) return;
    if (!isSessionActive({ idleAfterMs: ATTENTION_IDLE_MS })) return;
    markedMessageRef.current = key;
    void markDialogMessagesRead(dialogId, ticketId);
  }, [dialogId, ticketId, lastClientMessageId, clientChatOnScreen, activityEdge, markDialogMessagesRead]);

  return null;
}
