/**
 * A stand-in for what `MingoChatProvider` runs, the chat-state hook (the lib's chat engine and its live tail), that
 * counts how many are mounted, and a stand-in for the registry of dialogs on screen, so a test can assert "one state
 * for the session", "running only while a surface is registered" and "on screen only while the page says so" without
 * a backend. Installed with `vi.mock(…)` factories that import this module.
 */
import type { UnifiedChatState } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { useEffect, useState } from 'react';
import type { MingoUnifiedChat } from '../../hooks/use-mingo-unified-chat-state';

export const fakeChatProbe = {
  /** Hook instances ever created. */
  created: 0,
  /** Hook instances mounted right now: each runs the open dialog's live tail. */
  mounted: 0,
  /** Dialogs registered as on screen right now (`registerActiveDialogView`). */
  onScreen: [] as string[],
  /** What the hook returns. */
  result: null as MingoUnifiedChat | null,
  /** Thrown by the hook while set. */
  crash: null as Error | null,
};

export function resetFakeChatProbe(result: MingoUnifiedChat) {
  fakeChatProbe.created = 0;
  fakeChatProbe.mounted = 0;
  fakeChatProbe.onScreen = [];
  fakeChatProbe.result = result;
  fakeChatProbe.crash = null;
}

const noop = () => {};

interface FakeChatOptions {
  activeDialogId?: string | null;
  dialogError?: string | null;
  dialogNotFound?: boolean;
  isMessagesLoading?: boolean;
  selectDialog?: (id: string | null) => void;
  startNewDialog?: UnifiedChatState['startNewDialog'];
}

/** One result object, returned as-is on every render — the way the compiled hook memoizes it. */
export function makeFakeChat({
  activeDialogId = null,
  dialogError = null,
  dialogNotFound = false,
  isMessagesLoading = false,
  selectDialog = noop,
  startNewDialog = async () => null,
}: FakeChatOptions = {}): MingoUnifiedChat {
  return {
    state: {
      activeDialogId,
      isMessagesLoading,
      selectDialog,
      startNewDialog,
      dialogError,
      dialogsError: false,
      messages: [],
      dialogs: [],
      dialogCapabilities: { searchQuery: '', onSearchChange: noop },
    } as unknown as UnifiedChatState,
    dialogStatusOf: () => undefined,
    dialogNotFound,
    dialogCreatedAt: null,
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

/** `registerActiveDialogView`, counted. */
export function fakeRegisterActiveDialogView(dialogId: string): () => void {
  fakeChatProbe.onScreen.push(dialogId);
  return () => {
    fakeChatProbe.onScreen = fakeChatProbe.onScreen.filter(id => id !== dialogId);
  };
}
