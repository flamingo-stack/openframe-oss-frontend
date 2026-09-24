'use client';

import { useJetStreamDialogSubscription } from '@flamingo-stack/openframe-frontend-core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NATS_TOPICS } from '@/app/(app)/tickets/constants';
import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';
import { getFullImageUrl } from '@/lib/image-url';
import { useNatsAppConfig } from '@/lib/nats/nats-app-config';
import { useRemoteAccessSession } from '../components/remote-access/remote-access-session-context';
import { decodeRemoteSessionChatChunk, remoteSessionChatApiService } from '../services/remote-session-chat-api-service';
import {
  type IRemoteSessionChatService,
  isMockRemoteSessionDialog,
  mockRemoteSessionChatService,
  mockRemoteSessionDialogId,
} from '../services/remote-session-chat-service';
import type { RemoteSessionChatMessage, RemoteSessionChatTechnician } from '../types/remote-session-chat';

const CHAT_CHUNKS_STREAM = 'CHAT_CHUNKS';

/**
 * The chat dialog of the current remote session: on the real approval backend
 * the id the session record carries (null until the record is known, or when
 * the backend provisioned no chat); on the mock backend a dialog named after
 * the approved request, so the panel can be exercised without a backend.
 * Null with the flag off - the legacy auto-start session has no chat.
 */
export function useRemoteSessionDialogId(): string | null {
  const { requestId, session, live } = useRemoteAccessSession();
  if (live) return session?.dialogId ?? null;
  return requestId ? mockRemoteSessionDialogId(requestId) : null;
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

interface ChatStore {
  dialogId: string | null;
  /** The persisted page, oldest first. */
  history: RemoteSessionChatMessage[];
  /** What the feed delivered after the page, in arrival order. */
  live: RemoteSessionChatMessage[];
  historyLoaded: boolean;
  /** The page's highest stamped sequence; the feed opens right after it, older chunks are dropped. */
  lastSeq: number;
}

const EMPTY_STORE: ChatStore = { dialogId: null, history: [], live: [], historyLoaded: false, lastSeq: 0 };

function storeFor(prev: ChatStore, dialogId: string): ChatStore {
  return prev.dialogId === dialogId ? prev : { ...EMPTY_STORE, dialogId };
}

export interface RemoteSessionChatState {
  messages: RemoteSessionChatMessage[];
  isLoading: boolean;
  sending: boolean;
  technician: RemoteSessionChatTechnician;
  /** Resolves `false` when nothing was sent (blank text, no dialog, failure). */
  send: (body: string) => Promise<boolean>;
}

/**
 * History + live delivery for one session dialog. A real dialog is read from
 * the chat service and tailed on its JetStream subject from the page's last
 * sequence; the mock dialog is tailed in memory. Own messages come back
 * through the same feed as the end user's, so the list is one ordered stream,
 * deduplicated by id and by sequence against the page.
 */
export function useRemoteSessionChat(dialogId: string | null): RemoteSessionChatState {
  const isMock = isMockRemoteSessionDialog(dialogId);
  const service: IRemoteSessionChatService = isMock ? mockRemoteSessionChatService : remoteSessionChatApiService;
  // One record per dialog: a dialog change is a derived reset (no setState in
  // the effect body), live rows arriving before the page stay ordered after it.
  const [store, setStore] = useState<ChatStore>(EMPTY_STORE);
  const [sending, setSending] = useState(false);
  const technician = useRemoteSessionChatTechnician();
  const technicianRef = useRef(technician);
  useEffect(() => {
    technicianRef.current = technician;
  }, [technician]);

  const deliver = useCallback((dialog: string, message: RemoteSessionChatMessage) => {
    setStore(prev => {
      const base = storeFor(prev, dialog);
      if (message.seq !== undefined && message.seq <= base.lastSeq) return base;
      if (base.history.some(m => m.id === message.id) || base.live.some(m => m.id === message.id)) return base;
      return { ...base, live: [...base.live, message] };
    });
  }, []);

  // The page: at every dialog open and after every feed reconnect (the stream
  // keeps minutes, a longer outage leaves a gap only the page can fill).
  const [historyRevision, setHistoryRevision] = useState(0);
  useEffect(() => {
    if (!dialogId) return undefined;
    let cancelled = false;
    service
      .history(dialogId)
      .then(page => {
        if (cancelled) return;
        setStore(prev => {
          const base = storeFor(prev, dialogId);
          const known = new Set(page.messages.map(m => m.id));
          const lastSeq = Math.max(base.lastSeq, page.lastSeq);
          return {
            ...base,
            history: page.messages,
            live: base.live.filter(m => !known.has(m.id) && (m.seq === undefined || m.seq > lastSeq)),
            historyLoaded: true,
            lastSeq,
          };
        });
      })
      .catch(() => {
        // The panel simply starts empty; live delivery still works.
        if (cancelled) return;
        setStore(prev => ({ ...storeFor(prev, dialogId), historyLoaded: true }));
      });
    return () => {
      cancelled = true;
    };
  }, [service, dialogId, historyRevision]);

  // The mock's feed.
  useEffect(() => {
    if (!dialogId || !isMock) return undefined;
    return mockRemoteSessionChatService.subscribe(dialogId, message => deliver(dialogId, message));
  }, [dialogId, isMock, deliver]);

  // The real dialog's feed, from the page's tail once the page is in.
  const { getWsUrl, onBeforeReconnect } = useNatsAppConfig();
  const current = store.dialogId === dialogId ? store : EMPTY_STORE;
  const liveDialogId = dialogId && !isMock ? dialogId : null;
  const { reconnectionCount } = useJetStreamDialogSubscription({
    enabled: liveDialogId !== null && current.historyLoaded,
    dialogId: liveDialogId,
    streamName: CHAT_CHUNKS_STREAM,
    topic: NATS_TOPICS.MESSAGE,
    optStartSeq: current.lastSeq,
    onEvent: useCallback(
      (payload: unknown) => {
        if (!liveDialogId) return;
        const row = decodeRemoteSessionChatChunk(payload, technicianRef.current);
        if (row) deliver(liveDialogId, row);
      },
      [liveDialogId, deliver],
    ),
    onBeforeReconnect,
    getNatsWsUrl: getWsUrl,
  });
  const lastReconnectRef = useRef(0);
  useEffect(() => {
    if (reconnectionCount <= lastReconnectRef.current) return;
    lastReconnectRef.current = reconnectionCount;
    setHistoryRevision(n => n + 1);
  }, [reconnectionCount]);

  const send = useCallback(
    async (body: string) => {
      const text = body.trim();
      if (!dialogId || !text) return false;
      setSending(true);
      try {
        await service.send(dialogId, text, technicianRef.current);
        return true;
      } catch {
        return false;
      } finally {
        setSending(false);
      }
    },
    [service, dialogId],
  );

  const messages = useMemo(() => [...current.history, ...current.live], [current.history, current.live]);
  return {
    messages,
    isLoading: !!dialogId && !current.historyLoaded,
    sending,
    technician,
    send,
  };
}
