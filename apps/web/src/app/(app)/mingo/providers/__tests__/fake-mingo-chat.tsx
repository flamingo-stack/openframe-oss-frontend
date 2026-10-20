/**
 * Stand-ins for the two things `MingoChatProvider` runs — the chat-state hook and
 * the live tail — that count how many of each are mounted, so a test can assert
 * "one state for the session" and "running only while a surface is registered"
 * without a backend. Installed with `vi.mock(…)` factories that import this module.
 */
import type { UnifiedChatState } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { useEffect, useState } from 'react';
import type { MingoUnifiedChat } from '../../hooks/use-mingo-unified-chat-state';

export const fakeChatProbe = {
  /** Hook instances ever created. */
  created: 0,
  /** Hook instances mounted right now. */
  mounted: 0,
  /** Live tails mounted right now, by dialog id. */
  liveTails: [] as string[],
  /** The subset of `liveTails` that counts its dialog as on screen (`onScreen`). */
  onScreenTails: [] as string[],
  /** What the hook returns. */
  result: null as MingoUnifiedChat | null,
  /** Thrown by the hook while set. */
  crash: null as Error | null,
};

export function resetFakeChatProbe(result: MingoUnifiedChat) {
  fakeChatProbe.created = 0;
  fakeChatProbe.mounted = 0;
  fakeChatProbe.liveTails = [];
  fakeChatProbe.onScreenTails = [];
  fakeChatProbe.result = result;
  fakeChatProbe.crash = null;
}

const noop = () => {};

interface FakeChatOptions {
  activeDialogId?: string | null;
  dialogError?: string | null;
  selectDialog?: (id: string | null) => void;
  sendInNewDialog?: (text: string) => Promise<void>;
}

/** One result object, returned as-is on every render — the way the compiled hook memoizes it. */
export function makeFakeChat({
  activeDialogId = null,
  dialogError = null,
  selectDialog = noop,
  sendInNewDialog = async () => {},
}: FakeChatOptions = {}): MingoUnifiedChat {
  return {
    state: { activeDialogId, selectDialog, messages: [], dialogs: [] } as unknown as UnifiedChatState,
    subscription: {
      activeDialogId,
      isSubscribed: activeDialogId !== null,
      onApprove: noop,
      onReject: noop,
      approvalStatuses: {},
      onConnectionChange: noop,
      onMetadata: noop,
      initialOptStartSeq: null,
      isInitialOptStartSeqReady: true,
    },
    pendingApprovals: [],
    dialogStatusOf: () => undefined,
    dialogsLoadFailed: false,
    sendInNewDialog,
    createNamedDialog: async () => null,
    createIntentDialog: async () => null,
    searchQuery: '',
    setSearchQuery: noop,
    fetchArchivedDialogs: async () => ({ dialogs: [], nextCursor: null }),
    unarchiveDialog: async () => {},
    dialogError,
  };
}

export function useFakeMingoUnifiedChatState(): MingoUnifiedChat {
  useState(() => {
    fakeChatProbe.created += 1;
    return null;
  });
  useEffect(() => {
    fakeChatProbe.mounted += 1;
    return () => {
      fakeChatProbe.mounted -= 1;
    };
  }, []);
  if (fakeChatProbe.crash) throw fakeChatProbe.crash;
  if (!fakeChatProbe.result) throw new Error('fake chat: call resetFakeChatProbe() first');
  return fakeChatProbe.result;
}

export function FakeDialogSubscription({ dialogId, onScreen = true }: { dialogId: string; onScreen?: boolean }) {
  useEffect(() => {
    fakeChatProbe.liveTails.push(dialogId);
    return () => {
      fakeChatProbe.liveTails = fakeChatProbe.liveTails.filter(id => id !== dialogId);
    };
  }, [dialogId]);
  useEffect(() => {
    if (!onScreen) return undefined;
    fakeChatProbe.onScreenTails.push(dialogId);
    return () => {
      fakeChatProbe.onScreenTails = fakeChatProbe.onScreenTails.filter(id => id !== dialogId);
    };
  }, [dialogId, onScreen]);
  return null;
}
