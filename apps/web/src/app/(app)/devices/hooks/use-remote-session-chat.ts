'use client';

/**
 * A remote session's chat between the technician and the end user, on the lib's chat engine, the one web chat every
 * app runs. The session dialog is a DIRECT-mode client chat the backend provisions with the session, so this file is
 * the engine's configuration and the panel's view of its thread:
 *
 *   transport  the JetStream live tail of the dialog's `message` subject (it replays a gap and drops a redelivery
 *              itself), and the send of a client-chat message;
 *   history    the dialog's persisted client-chat pages, read with the lib's GraphQL document.
 *
 * The technician's own line shows as soon as it is sent (the engine's optimistic row), and its ADMIN-owned echo closes
 * the turn instead of drawing a second row. The panel draws people's lines only: system notices and assistant turns
 * are left out.
 */

import { type ChatMessage, textOfParts } from '@flamingo-stack/openframe-frontend-core/chat-protocol';
import {
  type ChatTransport,
  createMingoGraphqlHistory,
  jetStreamLiveTail,
  useChatEngine,
} from '@flamingo-stack/openframe-frontend-core/components/chat';
import { useCallback, useMemo, useState } from 'react';
import { postMingoGraphql } from '@/app/(app)/mingo/hooks/use-mingo-unified-chat-state';
import { CHAT_TYPE, NATS_TOPICS, OWNER_TYPE } from '@/app/(app)/tickets/constants';
import { ticketService } from '@/app/(app)/tickets/services';
import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';
import { getFullImageUrl } from '@/lib/image-url';
import { useNatsAppConfig } from '@/lib/nats/nats-app-config';
import { useRemoteAccessSession } from '../components/remote-access/remote-access-session-context';
import {
  REMOTE_SESSION_END_USER_NAME,
  type RemoteSessionChatMessage,
  type RemoteSessionChatTechnician,
} from '../types/remote-session-chat';

/** One page of the session dialog's persisted client-chat messages, oldest first. */
const fetchSessionChatHistory = createMingoGraphqlHistory(postMingoGraphql, { chatType: CHAT_TYPE.CLIENT });

/** The technician's own direct message comes back as theirs: an ADMIN row that names them, or no one. */
const ownUserId = () => useAuthStore.getState().user?.id;

/**
 * The chat dialog of the current remote session: the id the session record carries, null until the record is known
 * and when the backend provisioned no chat.
 */
export function useRemoteSessionDialogId(): string | null {
  return useRemoteAccessSession().session?.dialogId ?? null;
}

/** The signed-in technician as the chat shows them on their own rows. */
export function useRemoteSessionChatTechnician(): RemoteSessionChatTechnician {
  const user = useAuthStore(s => s.user);
  return useMemo(
    () => ({
      name: [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'Technician',
      avatarUrl: getFullImageUrl(user?.image?.imageUrl, user?.image?.hash),
    }),
    [user],
  );
}

/**
 * A message of the engine's thread as the panel's line, or null for what is not a person's line (a system notice, an
 * assistant turn, a hidden send). A row the engine wrote for the viewer's own send names no author: the technician's.
 */
export function sessionChatLineOf(
  message: ChatMessage,
  technician: RemoteSessionChatTechnician,
): RemoteSessionChatMessage | null {
  if (message.role !== 'user' || message.metadata?.hidden) return null;
  const body = textOfParts(message.parts);
  if (!body) return null;
  const author = message.metadata?.author;
  const fromEndUser = author?.authorType === 'user';
  return {
    id: message.id,
    author: fromEndUser ? 'user' : 'technician',
    authorName: fromEndUser ? REMOTE_SESSION_END_USER_NAME : author?.name || technician.name,
    sentAt: message.metadata?.createdAt ?? new Date().toISOString(),
    body,
  };
}

export interface RemoteSessionChatState {
  messages: RemoteSessionChatMessage[];
  isLoading: boolean;
  sending: boolean;
  technician: RemoteSessionChatTechnician;
  /** Resolves `false` when nothing was sent (blank text, no dialog, failure). */
  send: (body: string) => Promise<boolean>;
  /** The end user wrote while the panel was closed: the Open Chat marker. */
  hasUnread: boolean;
  /** The technician has seen the chat (the panel opened or closed). */
  markRead: () => void;
}

/** How many end-user lines the technician has seen in the dialog: the history it opened with, and what came in since. */
interface SeenLines {
  dialogId: string | null;
  count: number;
  /** The first page is in: until then nothing is counted as seen or unseen. */
  ready: boolean;
}

/**
 * The session dialog's chat: the engine's thread as the panel's lines, and the Open Chat marker. The tail runs whether
 * the panel is open or not, so an end-user line that arrives while `panelOpen` is false raises `hasUnread`; the history
 * the page opens with is old news and never does, nor do the technician's own lines.
 */
export function useRemoteSessionChat(dialogId: string | null, panelOpen = false): RemoteSessionChatState {
  const technician = useRemoteSessionChatTechnician();
  const { getWsUrl, onBeforeReconnect } = useNatsAppConfig();

  const transport = useMemo<ChatTransport>(
    () => ({
      replays: true,
      useLiveTail: jetStreamLiveTail({ getNatsWsUrl: getWsUrl, topic: NATS_TOPICS.MESSAGE, onBeforeReconnect }),
      publish: async (text, options) => {
        if (!options.dialogId) return false;
        await ticketService.sendMessage(options.dialogId, text, CHAT_TYPE.CLIENT);
        return true;
      },
    }),
    [getWsUrl, onBeforeReconnect],
  );

  const chat = useChatEngine(
    {
      transport,
      history: { fetchDialogMessages: fetchSessionChatHistory },
      dialogId,
      chatTypeFilter: CHAT_TYPE.CLIENT,
      directMode: true,
      directMessages: { ownDirectOwnerType: OWNER_TYPE.ADMIN, ownUserId },
    },
    { active: dialogId !== null },
  );

  const messages = useMemo(
    () => chat.messages.flatMap(message => sessionChatLineOf(message, technician) ?? []),
    [chat.messages, technician],
  );
  const endUserLines = messages.filter(line => line.author === 'user').length;
  const historyRead = dialogId !== null && !chat.isMessagesLoading;

  // What has been seen follows the thread during render (React's state from the previous render): the first page when
  // it arrives, and every line while the panel is open.
  const [seen, setSeen] = useState<SeenLines>({ dialogId: null, count: 0, ready: false });
  let next = seen.dialogId === dialogId ? seen : { dialogId, count: 0, ready: false };
  if (historyRead && !next.ready) next = { ...next, count: endUserLines, ready: true };
  if (next.ready && panelOpen && next.count !== endUserLines) next = { ...next, count: endUserLines };
  if (next !== seen) setSeen(next);

  const markRead = useCallback(() => {
    setSeen(prev => (prev.ready && prev.count !== endUserLines ? { ...prev, count: endUserLines } : prev));
  }, [endUserLines]);

  const [sending, setSending] = useState(false);
  const { sendMessage } = chat;
  const send = useCallback(
    async (body: string) => {
      const text = body.trim();
      if (!dialogId || !text) return false;
      setSending(true);
      try {
        return (await sendMessage(text)) !== false;
      } finally {
        setSending(false);
      }
    },
    [dialogId, sendMessage],
  );

  return {
    messages,
    isLoading: dialogId !== null && chat.isMessagesLoading,
    sending,
    technician,
    send,
    hasUnread: next.ready && endUserLines > next.count,
    markRead,
  };
}
