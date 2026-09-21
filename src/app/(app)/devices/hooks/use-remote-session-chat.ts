'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';
import { getFullImageUrl } from '@/lib/image-url';
import { useApprovedRemoteAccessRequestId } from '../components/remote-access/remote-access-session-context';
import { REMOTE_SESSION_CHAT_MOCK_ACTIVE, remoteSessionChatService } from '../services/remote-session-chat-service';
import type { RemoteSessionChatMessage, RemoteSessionChatTechnician } from '../types/remote-session-chat';

/**
 * The chat dialog of the current remote session (CU-86ajx041x).
 *
 * On the mock the id is derived from the approved request, so it exists
 * exactly when the approval flow ran (null with the `remote-access-approval`
 * flag off - the legacy auto-start session has no chat). The real id arrives
 * in `REMOTE_SESSION_STARTED` once the BE provisions the dialog with the
 * session (CU-86ajx02qj / CU-86ajx0359) - this hook is the one place to swap.
 */
export function useRemoteSessionDialogId(): string | null {
  const requestId = useApprovedRemoteAccessRequestId();
  return requestId ? `mock-dialog:${requestId}` : null;
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
  messages: RemoteSessionChatMessage[];
  historyLoaded: boolean;
}

const EMPTY_STORE: ChatStore = { dialogId: null, messages: [], historyLoaded: false };

export interface RemoteSessionChatState {
  messages: RemoteSessionChatMessage[];
  isLoading: boolean;
  sending: boolean;
  technician: RemoteSessionChatTechnician;
  /** True while the panel runs on the mock service. */
  isMock: boolean;
  /** Resolves `false` when nothing was sent (blank text, no dialog, failure). */
  send: (body: string) => Promise<boolean>;
}

/**
 * History + live delivery for one session dialog. Own messages come back
 * through the same subscription as the end user's, so the list is a single
 * ordered stream deduplicated by id.
 */
export function useRemoteSessionChat(dialogId: string | null): RemoteSessionChatState {
  // One record per dialog: a dialog change is a derived reset (no setState in
  // the effect body), live messages arriving before the history stay ordered
  // after it, and every append is deduplicated by id.
  const [store, setStore] = useState<ChatStore>(EMPTY_STORE);
  const [sending, setSending] = useState(false);
  const technician = useRemoteSessionChatTechnician();

  useEffect(() => {
    if (!dialogId) return undefined;
    let cancelled = false;
    const unsubscribe = remoteSessionChatService.subscribe(dialogId, message => {
      setStore(prev => {
        const base = prev.dialogId === dialogId ? prev : { dialogId, messages: [], historyLoaded: false };
        if (base.messages.some(m => m.id === message.id)) return base;
        return { ...base, messages: [...base.messages, message] };
      });
    });
    remoteSessionChatService
      .history(dialogId)
      .then(history => {
        if (cancelled) return;
        setStore(prev => {
          const live = prev.dialogId === dialogId ? prev.messages : [];
          const known = new Set(history.map(m => m.id));
          return { dialogId, messages: [...history, ...live.filter(m => !known.has(m.id))], historyLoaded: true };
        });
      })
      .catch(() => {
        // The panel simply starts empty; live delivery still works.
        if (cancelled) return;
        setStore(prev =>
          prev.dialogId === dialogId
            ? { ...prev, historyLoaded: true }
            : { dialogId, messages: [], historyLoaded: true },
        );
      });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [dialogId]);

  const send = useCallback(
    async (body: string) => {
      const text = body.trim();
      if (!dialogId || !text) return false;
      setSending(true);
      try {
        await remoteSessionChatService.send(dialogId, text, technician);
        return true;
      } catch {
        return false;
      } finally {
        setSending(false);
      }
    },
    [dialogId, technician],
  );

  const current = store.dialogId === dialogId ? store : EMPTY_STORE;
  return {
    messages: current.messages,
    isLoading: !!dialogId && !current.historyLoaded,
    sending,
    technician,
    isMock: REMOTE_SESSION_CHAT_MOCK_ACTIVE,
    send,
  };
}
