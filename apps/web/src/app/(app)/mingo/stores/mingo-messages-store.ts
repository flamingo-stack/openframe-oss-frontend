import type { TokenUsageData } from '@flamingo-stack/openframe-frontend-core';
import { type ChatMessage, textOfParts } from '@flamingo-stack/openframe-frontend-core/chat-protocol';
import {
  type BoundChatThread,
  type ChatModelMetadata,
  type ChatStreamReducer,
  chatThreadReducerOptions,
  createChatDialogStore,
  createChatThreadStore,
  DEFAULT_MAX_REDUCERS,
  type StreamingPhase,
} from '@flamingo-stack/openframe-frontend-core/components/chat';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { useAuthStore } from '@/stores';

/**
 * Message ACCUMULATION lives in the lib's thread store (`createChatThreadStore`, one reducer per dialogId, side 'main').
 * This zustand store survives as persistence/cache + identity only — dialog list, active id, unread counts,
 * loading/pagination, per-dialog seq bookkeeping — plus a READ MIRROR of each thread's snapshot (messages / streaming
 * phase / streaming bubble id / token usage) so existing selectors keep working unchanged. Thread commands (history
 * hydration, optimistic sends, welcome rows) delegate to the thread store.
 */

// ─── Lib thread store (module-level, outlives React) ────────────────────────

const metadataHandlerByDialog = new Map<string, (metadata: ChatModelMetadata) => void>();

/** Creation options for a dialog's reducer. The operator IS the admin: their own send echoes back as 'ADMIN'. */
const mingoReducerOptions = chatThreadReducerOptions<string>({
  ownEchoIncludesAdmin: true,
  selfUserId: () => useAuthStore.getState().user?.id,
  onMetadata: (dialogId, metadata) => metadataHandlerByDialog.get(dialogId)?.(metadata),
});

/** The lib's thread store: this host supplies only the reducer options and the zustand patch. Key = dialogId. */
const threads = createChatThreadStore<string>({
  // `defaultCreateOptions` closes the store-level hole: a reducer first materialized by a bare `apply()` / `mutate()`
  // would otherwise be built WITHOUT `ownEchoIncludesAdmin` / `selfUserId` and keep them missing for its whole life
  // (creation options are consulted once), so every message this user sends would render twice.
  createStore: storeOptions => createChatDialogStore({ ...storeOptions, defaultCreateOptions: mingoReducerOptions }),
  options: mingoReducerOptions,
  onSnapshot: (dialogId, { messages, phase, streamingId, state: snap }) => {
    const usage = snap.dialogTokenUsage ?? null;
    useMingoMessagesStore.setState(state => {
      const newMessagesMap = new Map(state.messagesByDialog);
      newMessagesMap.set(dialogId, messages);
      const newPhaseMap = new Map(state.phaseByDialog);
      newPhaseMap.set(dialogId, phase);
      const newStreamingMap = new Map(state.streamingIdByDialog);
      newStreamingMap.set(dialogId, streamingId);

      const patch: Partial<MingoMessagesStore> = {
        messagesByDialog: newMessagesMap,
        phaseByDialog: newPhaseMap,
        streamingIdByDialog: newStreamingMap,
      };
      // ADDITIVE ON PURPOSE: a post-eviction re-seed restores `messages` only,
      // so the replacement reducer's first snapshot carries no token usage. A
      // blanking write here would drop counters the host still legitimately
      // holds — an empty/absent `usage` must never clear `tokenUsageByDialog`.
      if (usage && state.tokenUsageByDialog.get(dialogId) !== usage) {
        const newUsageMap = new Map(state.tokenUsageByDialog);
        newUsageMap.set(dialogId, usage as TokenUsageData);
        patch.tokenUsageByDialog = newUsageMap;
      }
      return patch;
    });
  },
});

/** The dialog store behind this host's reducers (built by the thread store). */
export const mingoChatDialogStore = threads.store;

/** Late-bind the model-badge handler (it rides the reducer effect). */
export function setMingoMetadataHandler(
  dialogId: string,
  onMetadata: ((metadata: ChatModelMetadata) => void) | undefined,
): void {
  if (onMetadata) metadataHandlerByDialog.set(dialogId, onMetadata);
  else metadataHandlerByDialog.delete(dialogId);
}

/** Pre-curried `{ decode, apply, mutate, mergeApprovalStatuses }` for one dialog.
 *  Identity is stable per dialogId (memoized inside the thread store). */
export function bindMingoDialog(dialogId: string): BoundChatThread {
  return threads.bind(dialogId);
}

/** Run reducer commands (non-wire mutations) against a dialog, then threads. */
export function mutateMingoDialog<T>(dialogId: string, fn: (reducer: ChatStreamReducer) => T): T {
  return threads.mutate(dialogId, fn);
}

/** How many most-recently opened dialogs keep their threads cached — the
 *  lib reducer cap, which re-seed parking would otherwise defeat: every dialog
 *  opened stayed in memory for the life of the page, and the desktop shell's
 *  page lives for days. */
const MAX_CACHED_DIALOGS = DEFAULT_MAX_REDUCERS;

/** Dialogs in the order they were last opened, oldest first. */
const recentDialogIds: string[] = [];

function forgetRecent(dialogId: string): void {
  const index = recentDialogIds.indexOf(dialogId);
  if (index !== -1) recentDialogIds.splice(index, 1);
}

function dropDialogCaches(dialogId: string): void {
  threads.drop(dialogId);
  metadataHandlerByDialog.delete(dialogId);
  forgetRecent(dialogId);
}

// ─── Zustand store (persistence/cache + identity + read mirror) ─────────────

interface MingoMessagesStore {
  // Read mirror of the lib reducer state — key is dialogId
  messagesByDialog: Map<string, ChatMessage[]>;
  phaseByDialog: Map<string, StreamingPhase>;
  /** Id of the assistant bubble an open stream writes into (merge exemption). */
  streamingIdByDialog: Map<string, string | null>;
  tokenUsageByDialog: Map<string, TokenUsageData>;

  // Dialog state
  activeDialogId: string | null;

  unreadCounts: Map<string, number>;
  // Highest JetStream streamSeq observed per dialog. Persists across
  // DialogSubscription remounts.
  highestStreamSeqByDialog: Map<string, number>;

  // Loading states
  isLoadingDialog: boolean;
  isLoadingMessages: boolean;
  isCreatingDialog: boolean;

  // Error states
  dialogError: string | null;
  messagesError: string | null;

  // Pagination
  hasMoreMessages: boolean;
  messagesCursor: string | null;
  newestMessageCursor: string | null;

  // Core Actions
  setActiveDialogId: (dialogId: string | null) => void;

  // Thread commands (delegate to the lib reducer)
  setMessages: (dialogId: string, messages: ChatMessage[]) => void;
  prependMessages: (dialogId: string, messages: ChatMessage[]) => void;
  prependWithBoundaryMerge: (
    dialogId: string,
    newMessages: ChatMessage[],
    boundaryMessageId?: string,
    boundaryUpdates?: Partial<ChatMessage>,
  ) => void;
  addMessage: (dialogId: string, message: ChatMessage) => void;
  /** Optimistic local send. Routed through the reducer so IT owns own-echo
   *  suppression (text-matched, one-shot) — a blanket "drop every echo with
   *  my user id" would also hide this user's sends from other tabs. */
  pushOptimisticSend: (dialogId: string, message: ChatMessage) => void;
  updateMessage: (dialogId: string, messageId: string, updates: Partial<ChatMessage>) => void;
  removeMessage: (dialogId: string, messageId: string) => void;
  /** Cross-message approval flip (the reducer's projection). */
  updateApprovalStatusInMessages: (
    dialogId: string,
    requestId: string,
    status: 'approved' | 'rejected',
    resolvedByName?: string | null,
  ) => void;
  /** The thread as it stands, deltas still in the batcher included: what a history merge builds its write from. */
  getMessages: (dialogId: string) => ChatMessage[];
  removeWelcomeMessages: (dialogId: string) => void;

  // Typing / phase (delegates to the reducer's phase machine)
  setTyping: (dialogId: string, typing: boolean) => void;
  getTyping: (dialogId: string) => boolean;
  getStreamingId: (dialogId: string) => string | null;

  // Unread
  incrementUnread: (dialogId: string) => void;
  resetUnread: (dialogId: string) => void;
  getUnread: (dialogId: string) => number;

  // Token Usage
  setTokenUsage: (dialogId: string, data: TokenUsageData) => void;
  getTokenUsage: (dialogId: string) => TokenUsageData | null;

  // Stream sequence tracking
  recordHighestStreamSeq: (dialogId: string, seq: number) => void;
  getHighestStreamSeq: (dialogId: string) => number;

  // Utility Actions
  clearDialog: (dialogId: string) => void;
  resetAll: () => void;

  // Loading States
  setLoadingDialog: (loading: boolean) => void;
  setLoadingMessages: (loading: boolean) => void;
  setCreatingDialog: (creating: boolean) => void;

  // Error States
  setDialogError: (error: string | null) => void;
  setMessagesError: (error: string | null) => void;

  // Pagination
  setPagination: (hasMore: boolean, cursor: string | null, newestCursor: string | null) => void;
}

export const useMingoMessagesStore = create<MingoMessagesStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      messagesByDialog: new Map(),
      phaseByDialog: new Map(),
      streamingIdByDialog: new Map(),
      tokenUsageByDialog: new Map(),
      activeDialogId: null,
      unreadCounts: new Map(),
      highestStreamSeqByDialog: new Map(),

      isLoadingDialog: false,
      isLoadingMessages: false,
      isCreatingDialog: false,

      dialogError: null,
      messagesError: null,

      hasMoreMessages: false,
      messagesCursor: null,
      newestMessageCursor: null,

      // Core Actions
      setActiveDialogId: (dialogId: string | null) => {
        // The active dialog is the only DISPLAYED thread, so it is the only
        // one pinned against the reducer LRU. Every other visited dialog
        // falls back to protection-by-recency (plus the store's own
        // mid-stream guard); if one is evicted, the store PUBLISHES that via
        // `onEvict` and the thread store parks the key's state, re-seeding the
        // replacement reducer with it on the next `getReducer`.
        threads.setActiveKeys(dialogId ? [dialogId] : []);
        set({ activeDialogId: dialogId });

        if (!dialogId) return;
        forgetRecent(dialogId);
        recentDialogIds.push(dialogId);
        if (recentDialogIds.length > MAX_CACHED_DIALOGS) {
          recentDialogIds.splice(0, recentDialogIds.length - MAX_CACHED_DIALOGS);
        }

        // Drop the threads of dialogs outside the recent window, together with
        // their stream cursor: reopening one then resumes the live tail from
        // the history it loads, so JetStream replays what history lacks
        // (realtime-only guide frames, turns newer than a cached history
        // page) — the same as opening it after a page reload. Only the active
        // dialog has a live subscription and it is always in the window, so a
        // dialog left mid-stream is evicted too: nothing would ever end its
        // stream while it is closed. Unread counts and token usage are small
        // and stay.
        const recent = new Set(recentDialogIds);
        const stale = [...new Set([...threads.knownKeys(), ...get().messagesByDialog.keys()])].filter(
          key => !recent.has(key),
        );
        if (stale.length === 0) return;
        for (const key of stale) dropDialogCaches(key);
        set(state => {
          const messages = new Map(state.messagesByDialog);
          const phases = new Map(state.phaseByDialog);
          const streaming = new Map(state.streamingIdByDialog);
          const cursors = new Map(state.highestStreamSeqByDialog);
          for (const key of stale) {
            messages.delete(key);
            phases.delete(key);
            streaming.delete(key);
            cursors.delete(key);
          }
          return {
            messagesByDialog: messages,
            phaseByDialog: phases,
            streamingIdByDialog: streaming,
            highestStreamSeqByDialog: cursors,
          };
        });
      },

      // Thread commands — the lib reducer owns the mutation semantics
      // `threads.hydrate`, NOT a raw thread write: restoring a turn takes three
      // steps that only work together (thread, agent-busy extras,
      // adopt-once) — see `ChatThreadHydrateOptions`. This is the ONLY full-thread write
      // on the mingo hydration path (the paginated one goes through
      // `prependWithBoundaryMerge`), so it maps 1:1 onto the lib adapter's
      // `cursor === undefined` first-page branch.
      setMessages: (dialogId, messages) => {
        threads.hydrate(dialogId, messages);
      },

      prependMessages: (dialogId, messages) => {
        mutateMingoDialog(dialogId, r => r.prependMessages(messages));
      },

      prependWithBoundaryMerge: (dialogId, newMessages, boundaryMessageId?, boundaryUpdates?) => {
        threads.prependWithBoundaryMerge(dialogId, newMessages, boundaryMessageId, boundaryUpdates);
      },

      addMessage: (dialogId, message) => {
        threads.upsertMessage(dialogId, message);
      },

      pushOptimisticSend: (dialogId, message) => {
        threads.pushOptimisticSend(dialogId, textOfParts(message.parts), { message });
      },

      updateMessage: (dialogId, messageId, updates) => {
        threads.patchMessage(dialogId, messageId, updates);
      },

      removeMessage: (dialogId, messageId) => {
        threads.removeMessage(dialogId, messageId);
      },

      updateApprovalStatusInMessages: (dialogId, requestId, status, resolvedByName?) => {
        threads.updateApprovalStatus(dialogId, requestId, status, resolvedByName);
      },

      getMessages: (dialogId: string) => {
        threads.flush();
        return get().messagesByDialog.get(dialogId) || [];
      },

      removeWelcomeMessages: (dialogId: string) => {
        threads.mutateThread(dialogId, current => {
          const filtered = current.filter(m => !m.id.startsWith('welcome-'));
          return filtered.length === current.length ? current : filtered;
        });
      },

      // Typing / phase
      setTyping: (dialogId, typing) => {
        threads.setTyping(dialogId, typing);
      },

      getTyping: (dialogId: string) => {
        return (get().phaseByDialog.get(dialogId) ?? 'idle') !== 'idle';
      },

      getStreamingId: (dialogId: string) => {
        return get().streamingIdByDialog.get(dialogId) ?? null;
      },

      incrementUnread: (dialogId: string) => {
        set(state => {
          if (state.activeDialogId === dialogId) return state;

          const newMap = new Map(state.unreadCounts);
          const currentCount = newMap.get(dialogId) || 0;
          newMap.set(dialogId, currentCount + 1);
          return { unreadCounts: newMap };
        });
      },

      resetUnread: (dialogId: string) => {
        set(state => {
          const newMap = new Map(state.unreadCounts);
          newMap.set(dialogId, 0);
          return { unreadCounts: newMap };
        });
      },

      getUnread: (dialogId: string) => {
        return get().unreadCounts.get(dialogId) || 0;
      },

      // Routed through the REDUCER, not written straight into the mirror map:
      // the reducer's `onTokenUsage` frames already own `dialogTokenUsage`, so
      // a direct `set` here made two writers for one field with no stated
      // precedence — a persisted seed landing after a live frame would silently
      // roll the counters back. Going through the reducer means the same
      // last-write-wins rule applies to both, and the mirror stays the only
      // writer of `tokenUsageByDialog`.
      setTokenUsage: (dialogId: string, data: TokenUsageData) => {
        mutateMingoDialog(dialogId, r => r.setDialogTokenUsage(data));
      },

      getTokenUsage: (dialogId: string) => {
        return get().tokenUsageByDialog.get(dialogId) || null;
      },

      recordHighestStreamSeq: (dialogId: string, seq: number) => {
        set(state => {
          const current = state.highestStreamSeqByDialog.get(dialogId) ?? 0;
          if (seq <= current) return state;
          const newMap = new Map(state.highestStreamSeqByDialog);
          newMap.set(dialogId, seq);
          return { highestStreamSeqByDialog: newMap };
        });
      },

      getHighestStreamSeq: (dialogId: string) => {
        return get().highestStreamSeqByDialog.get(dialogId) ?? 0;
      },

      clearDialog: (dialogId: string) => {
        dropDialogCaches(dialogId);
        set(state => {
          const newMessagesMap = new Map(state.messagesByDialog);
          const newPhaseMap = new Map(state.phaseByDialog);
          const newStreamingMap = new Map(state.streamingIdByDialog);
          const newUnreadMap = new Map(state.unreadCounts);
          const newTokenUsageMap = new Map(state.tokenUsageByDialog);
          const newHighestSeqMap = new Map(state.highestStreamSeqByDialog);

          newMessagesMap.delete(dialogId);
          newPhaseMap.delete(dialogId);
          newStreamingMap.delete(dialogId);
          newUnreadMap.delete(dialogId);
          newTokenUsageMap.delete(dialogId);
          newHighestSeqMap.delete(dialogId);

          return {
            messagesByDialog: newMessagesMap,
            phaseByDialog: newPhaseMap,
            streamingIdByDialog: newStreamingMap,
            unreadCounts: newUnreadMap,
            tokenUsageByDialog: newTokenUsageMap,
            highestStreamSeqByDialog: newHighestSeqMap,
          };
        });
      },

      resetAll: () => {
        for (const dialogId of threads.knownKeys()) dropDialogCaches(dialogId);
        recentDialogIds.length = 0;
        // Nothing is displayed after a reset — release any surviving pin.
        threads.setActiveKeys([]);
        set({
          messagesByDialog: new Map(),
          phaseByDialog: new Map(),
          streamingIdByDialog: new Map(),
          tokenUsageByDialog: new Map(),
          activeDialogId: null,
          unreadCounts: new Map(),
          highestStreamSeqByDialog: new Map(),
          isLoadingDialog: false,
          isLoadingMessages: false,
          isCreatingDialog: false,
          dialogError: null,
          messagesError: null,
          hasMoreMessages: false,
          messagesCursor: null,
          newestMessageCursor: null,
        });
      },

      setLoadingDialog: (loading: boolean) => {
        set({ isLoadingDialog: loading });
      },

      setLoadingMessages: (loading: boolean) => {
        set({ isLoadingMessages: loading });
      },

      setCreatingDialog: (creating: boolean) => {
        set({ isCreatingDialog: creating });
      },

      // Error States
      setDialogError: (error: string | null) => {
        set({ dialogError: error });
      },

      setMessagesError: (error: string | null) => {
        set({ messagesError: error });
      },

      // Pagination
      setPagination: (hasMore: boolean, cursor: string | null, newestCursor: string | null) => {
        set({
          hasMoreMessages: hasMore,
          messagesCursor: cursor,
          newestMessageCursor: newestCursor,
        });
      },
    }),
    {
      name: 'mingo-messages-store',
    },
  ),
);
