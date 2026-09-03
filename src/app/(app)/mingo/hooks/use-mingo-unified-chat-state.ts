'use client';

/**
 * useMingoUnifiedChatState — adapts the existing `/mingo` data stack
 * (react-query + the `mingo-messages-store` Zustand store + the NATS/JetStream
 * realtime subscription) into the lib's `UnifiedChatState` shape so it can be
 * injected straight into `<EmbeddableChat mingoState={…}>`.
 *
 * Why this exists: the EmbeddableChat drawer previously drove the lib's
 * built-in `useNatsChatAdapter`, which owns dialog/message/streaming state in
 * local React state — so it was lost on every panel unmount, forcing the
 * `keepMounted` workaround. The `/mingo` page already solved persistence the
 * right way: its data lives OUTSIDE the component (react-query cache + the
 * global Zustand store), so it survives unmount for free. This hook reuses
 * those exact sub-hooks (no reinvention) and maps their output onto the
 * unified contract; the panel can now unmount on close and rehydrate instantly
 * on reopen, with realtime caught up via JetStream replay — no `keepMounted`.
 *
 * It does NOT touch the `/mingo` page: it composes the same building blocks
 * (`useMingoDialogs`, `useMingoDialogSelection`, `useMingoChat`,
 * `useMingoRealtimeSubscription`, `useMingoMessagesStore`) independently.
 *
 * Realtime is a rendered component (`<DialogSubscription>`), not a hook, so
 * this returns a `subscription` bundle the host renders alongside the chat.
 */

import type {
  ChatConnectionState,
  ChatRef,
  DialogItem,
  DialogTokenUsage,
  MessageSegment,
  SlashCommandSummary,
  StreamingPhase,
  UnifiedChatMessage,
  UnifiedChatState,
  UnifiedSendMessageOptions,
} from '@flamingo-stack/openframe-frontend-core/components/chat';
import {
  buildDiscussPrompt,
  defaultTableIdForDocumentType,
  sanitizeTitleForChat,
  useSlashCommandRegistry,
} from '@flamingo-stack/openframe-frontend-core/components/chat';
import { useChatRuntime } from '@flamingo-stack/openframe-frontend-core/contexts';
import { useCallback, useDeferredValue, useMemo, useRef, useState } from 'react';
import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';
import { useAiModelStatus } from '@/app/hooks/use-ai-model';
import { EVENT_SUBTYPE, trackDashboardActivity } from '@/lib/analytics';
import { CONTEXT_ITEMS_MAX, RECENT_VIEWS_MAX } from '../context/context-types';
import { useMingoContextStore } from '../stores/mingo-context-store';
import { useMingoMessagesStore } from '../stores/mingo-messages-store';
import { type MingoSendContext, type ProcessedMessage, useMingoChat } from './use-mingo-chat';
import { useMingoDialogActions } from './use-mingo-dialog-actions';
import { useMingoDialogSelection } from './use-mingo-dialog-selection';
import { useMingoDialogs } from './use-mingo-dialogs';
import { useMingoRealtimeSubscription } from './use-mingo-realtime-subscription';

const ADMIN_CHAT_TYPE = 'ADMIN_AI_CHAT' as const;
const WELCOME_TEXT = "Hi! I'm Mingo AI, ready to help with your technical tasks. What can I do for you?";

/** Metadata frame shape emitted by `<DialogSubscription onMetadata>`. */
interface MetadataFrame {
  modelDisplayName: string;
  modelName: string;
  providerName: string;
  contextWindow: number;
}

/** Props the host needs to render `<DialogSubscription>` for the active dialog. */
export interface MingoSubscriptionBindings {
  activeDialogId: string | null;
  /** True once the active dialog has been subscribed — gates rendering. */
  isSubscribed: boolean;
  onApprove: (requestId?: string) => void | Promise<void>;
  onReject: (requestId?: string) => void | Promise<void>;
  approvalStatuses: Record<string, string>;
  onConnectionChange: (dialogId: string, connected: boolean) => void;
  onMetadata: (metadata: MetadataFrame) => void;
  initialOptStartSeq: number;
  isInitialOptStartSeqReady: boolean;
}

export interface MingoUnifiedChat {
  state: UnifiedChatState;
  subscription: MingoSubscriptionBindings;
  /**
   * PENDING approval cards, lifted out of the thread by `useMingoChat` — it
   * filters them from their bubble so an interrupted retry cannot render the
   * same request twice. They therefore reach the view ONLY through the chat's
   * sticky-footer prop, which is why they travel beside `state` rather than
   * inside it.
   */
  pendingApprovals: MessageSegment[];
  /**
   * Create a brand-new dialog and send `text` into it, regardless of any
   * currently-active dialog. Used by external launchers (e.g. the "Ask Mingo
   * about X" EmptyState buttons) that always want a fresh conversation.
   */
  sendInNewDialog: (text: string) => Promise<void>;
  /** Current server-side dialog-search term. */
  searchQuery: string;
  /** Set the dialog-search term (already debounced by the chat's search bar). */
  setSearchQuery: (query: string) => void;
  /** Fetch a page of ARCHIVED dialogs — feeds the chat archive page. */
  fetchArchivedDialogs: (params: { cursor?: string; limit?: number; search?: string }) => Promise<{
    dialogs: DialogItem[];
    nextCursor: string | null;
  }>;
  /** Restore an archived dialog back to the active list. */
  unarchiveDialog: (id: string) => Promise<void>;
  /**
   * Why the SELECTED dialog could not be fetched, or null. `UnifiedChatState` has no
   * field for it (`dialogsError` is about the LIST), and without it a dialog id that
   * no longer resolves — a deleted conversation, someone else's, a mistyped link —
   * renders as an ordinary empty thread and says nothing.
   */
  dialogError: string | null;
}

/**
 * Whether the rail must move to "All Chats" to be capable of listing this dialog.
 *
 * "My Chats" is a server-side filter for dialogs THIS user owns, so a conversation
 * opened without going through the list — a shared link, a notification tap — can
 * land on a tab that structurally cannot contain it.
 *
 * Both `undefined` cases are deliberate no-ops rather than defensive noise:
 * a client (machine-owned) dialog has no `ownerUserId` and belongs to neither admin
 * scope, and an unresolved viewer would make every dialog look like someone else's.
 */
export function needsAllChatsScope(ownerUserId: string | undefined, currentUserId: string | undefined): boolean {
  if (!ownerUserId || !currentUserId) return false;
  return ownerUserId !== currentUserId;
}

export function mapMingoMessageToUnified(message: ProcessedMessage): UnifiedChatMessage {
  const {
    content,
    role: messageRole,
    name,
    avatar,
    authorType,
    assistantType: _assistantType,
    contextItems,
    ...metadata
  } = message;
  const role: 'user' | 'assistant' = messageRole === 'user' ? 'user' : 'assistant';
  const identity =
    role === 'user'
      ? {
          name: name && name !== 'Unknown' ? name : undefined,
          avatar: avatar ?? null,
          authorType,
        }
      : {};
  const context = role === 'user' && contextItems?.length ? { contextItems } : {};

  return Array.isArray(content)
    ? {
        ...metadata,
        role,
        content: '',
        segments: content,
        ...identity,
        ...context,
      }
    : {
        ...metadata,
        role,
        content,
        ...identity,
        ...context,
      };
}

export function sendMingoDisplayCommand(
  reference: ChatRef,
  commands: SlashCommandSummary[],
  sendMessage: (text: string) => unknown,
): boolean {
  const tableIds = [reference.sourceRepo, defaultTableIdForDocumentType(reference.type)].filter(
    (tableId, index, values): tableId is string => Boolean(tableId) && values.indexOf(tableId) === index,
  );
  const command = tableIds
    .map(tableId =>
      commands.find(
        candidate => candidate.primarySourceId === tableId && candidate.actions.some(a => a.id === 'display'),
      ),
    )
    .find((candidate): candidate is SlashCommandSummary => Boolean(candidate));
  if (!command) return false;

  const slug =
    typeof reference.metadata?.slug === 'string' && reference.metadata.slug.length > 0 ? reference.metadata.slug : '';
  const queryValue = slug || sanitizeTitleForChat(reference.title) || reference.id;
  const escaped = queryValue.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  void sendMessage(`/${command.id} display "${escaped}"`);
  return true;
}

export function hasMingoDisplayCommand(commands: SlashCommandSummary[]): boolean {
  return commands.some(command => command.actions.some(action => action.id === 'display'));
}

export function useMingoUnifiedChatState(): MingoUnifiedChat {
  const { aiModel } = useAiModelStatus();
  const commandsUrl = useChatRuntime()?.endpoints.commandsUrl ?? '';
  const { commands: slashCommands } = useSlashCommandRegistry(commandsUrl, { enabled: Boolean(commandsUrl) });

  const { activeDialogId, setActiveDialogId, resetUnread, addMessage, tokenUsageByDialog } = useMingoMessagesStore();

  // Server-side dialog search. The embeddable chat's search bar emits the
  // already-debounced term via `setSearchQuery`; it rides the `useMingoDialogs`
  // query key, so the backend filters the list.
  const [searchQuery, setSearchQuery] = useState('');

  // "My Chats / All Chats" rail selector — MY by default. Server-side filter:
  // rides the `useMingoDialogs` query key as `DialogFilterInput.scope`.
  const [dialogScope, setDialogScope] = useState<'my' | 'all'>('my');
  // The scope the QUERY runs with, deferred by one render. `dialogScope` itself
  // stays urgent, so the rail's selector repaints the moment it's clicked;
  // swapping the infinite query (new key → mount + request + skeleton across the
  // whole list) is heavy enough that batching it into the same commit visibly
  // held the highlight on the OLD tab for a frame — most noticeable on the first
  // switch, when nothing is cached for the target scope yet. React renders the
  // deferred value in a background pass, so the tab no longer waits on it.
  const deferredDialogScope = useDeferredValue(dialogScope);

  const {
    dialogs,
    isLoading: isLoadingDialogs,
    isError: isDialogsError,
    isFetchingNextPage: isFetchingNextDialogPage,
    hasNextPage: hasMoreDialogs,
    fetchNextPage: fetchNextDialogPage,
    refetch: refetchDialogs,
  } = useMingoDialogs({ search: searchQuery || undefined, scope: deferredDialogScope });

  const { renameDialog, archiveDialog, unarchiveDialog, fetchArchivedDialogs } = useMingoDialogActions();

  const {
    selectDialog: selectDialogMut,
    isLoadingDialog,
    isLoadingMessages,
    handleApprove,
    handleReject,
    approvalStatuses,
    dialogData,
    hasNextPage: hasMoreMessages,
    fetchNextPage: fetchNextMessagePage,
    initialOptStartSeq,
    isMessagesFetched,
    dialogError,
  } = useMingoDialogSelection();

  const {
    messages: processedMessages,
    approvals: pendingApprovals,
    createDialog,
    sendMessage: sendMingoMessage,
    stopGeneration,
    isTyping,
    isCompacting,
  } = useMingoChat(activeDialogId);

  const { subscribeToDialog, subscribedDialogs, onConnectionChange, connectionState } =
    useMingoRealtimeSubscription(activeDialogId);

  // Reconcile the rail's scope with whoever owns the OPEN conversation.
  //
  // The scope is a filter over the LIST, but a dialog can arrive without going
  // through the list at all — a shared link, a notification tap — and "My Chats"
  // only contains dialogs this user owns. So opening someone else's conversation
  // leaves the rail on a tab that cannot contain it: the chat is right there, and
  // the list beside it says it doesn't exist. Both cases QA hit are this one
  // (a link copied from All Chats, and user A's link opened by user B).
  //
  // Once per dialog, never back to 'my': the switch answers "this tab can't show
  // what you're looking at", which is only ever true in one direction, and
  // re-deciding on every render would fight a user who then picks a tab themselves.
  const currentUserId = useAuthStore(state => state.user?.id);
  // Reconciled during render, and latched in state rather than a ref: the scope
  // decides which list is on screen, so an effect would show the wrong tab —
  // the one that cannot list this dialog — for a frame after opening the link.
  const [scopeReconciledFor, setScopeReconciledFor] = useState<string | null>(null);
  if (activeDialogId && dialogData && scopeReconciledFor !== activeDialogId) {
    setScopeReconciledFor(activeDialogId);
    // Absent on a client (machine-owned) dialog, which neither admin scope lists —
    // nothing to reconcile there.
    const ownerId = dialogData.owner?.userId;
    if (needsAllChatsScope(ownerId, currentUserId)) setDialogScope('all');
  }

  // ─── Live model metadata (refined per-turn by `metadata` frames) ──────────
  const [liveModel, setLiveModel] = useState<{ displayName: string; provider: string } | null>(null);
  const onMetadata = useCallback((meta: MetadataFrame) => {
    setLiveModel({ displayName: meta.modelDisplayName, provider: meta.providerName });
  }, []);
  // Memoized: the object literal in the fallback is new on every render, and the
  // chat-state memo below takes `model` as a dependency.
  const model = useMemo(
    () => liveModel ?? (aiModel ? { displayName: aiModel.displayName, provider: aiModel.provider } : null),
    [liveModel, aiModel],
  );

  // ─── Token usage: store (kept live by realtime) first, dialog query fallback ─
  const tokenUsage = useMemo<DialogTokenUsage | null>(() => {
    if (!activeDialogId) return null;
    const cached = tokenUsageByDialog.get(activeDialogId);
    if (cached) {
      return {
        chatType: ADMIN_CHAT_TYPE,
        inputTokensSize: cached.inputTokensSize ?? 0,
        outputTokensSize: cached.outputTokensSize ?? 0,
        totalTokensSize: cached.totalTokensSize ?? 0,
        contextSize: cached.contextSize ?? 0,
      };
    }
    const u = dialogData?.tokenUsage?.find(t => t.chatType === ADMIN_CHAT_TYPE);
    if (!u) return null;
    return {
      chatType: ADMIN_CHAT_TYPE,
      inputTokensSize: u.inputTokensSize ?? 0,
      outputTokensSize: u.outputTokensSize ?? 0,
      totalTokensSize: u.totalTokensSize ?? 0,
      contextSize: u.contextSize ?? 0,
    };
  }, [activeDialogId, tokenUsageByDialog, dialogData?.tokenUsage]);

  // ─── Messages: ProcessedMessage[] → UnifiedChatMessage[] ──────────────────
  // The lib re-derives assistantType itself and folds 'error' into the
  // assistant bubble (same as the /mingo list). For USER bubbles we surface the
  // real sender identity — the admin's name (GraphQL `owner.user` / optimistic
  // auth-store), avatar, and `authorType` — so the embeddable chat matches the
  // standalone /mingo page: the sender shows up as the admin (accent name color)
  // instead of the hardcoded "You". Assistant rows keep the lib's Mingo defaults
  // (brand icon + "Mingo"), and a missing/Unknown name degrades to the lib's
  // "You" fallback.
  // `processedMessages` hands back referentially-stable objects for unchanged
  // messages (see useMingoChat's reconciliation), so keying a WeakMap by the
  // source object yields a stable UnifiedChatMessage too — the lib's reference-
  // equality memo then re-renders only the streaming bubble, not the whole list
  // (which would otherwise collapse open menus/cards on every chunk).
  const unifiedCacheRef = useRef(new WeakMap<object, UnifiedChatMessage>());
  const messages = useMemo<UnifiedChatMessage[]>(() => {
    const cache = unifiedCacheRef.current;
    return processedMessages.map(m => {
      const cached = cache.get(m);
      if (cached) return cached;
      const unified = mapMingoMessageToUnified(m);
      cache.set(m, unified);
      return unified;
    });
  }, [processedMessages]);

  // ─── Streaming phase: idle → thinking → streaming ─────────────────────────
  // The lib reducer's phase machine is the source of truth (mirrored per
  // dialog); a standalone compaction window still locks the composer.
  const reducerPhase = useMingoMessagesStore(s =>
    activeDialogId ? (s.phaseByDialog.get(activeDialogId) ?? 'idle') : 'idle',
  );
  const streamingPhase = useMemo<StreamingPhase>(() => {
    if (reducerPhase !== 'idle') return reducerPhase;
    if (isTyping || isCompacting) return 'thinking';
    return 'idle';
  }, [reducerPhase, isTyping, isCompacting]);

  // ─── Dialog selection (mirrors the /mingo page glue, minus URL syncing) ───
  const selectDialog = useCallback(
    (id: string | null) => {
      if (id === null) {
        setActiveDialogId(null);
        return;
      }
      if (id === activeDialogId) return;
      setActiveDialogId(id);
      resetUnread(id);
      subscribeToDialog(id);
      selectDialogMut(id);
    },
    [activeDialogId, setActiveDialogId, resetUnread, subscribeToDialog, selectDialogMut],
  );

  // ─── Create a fresh dialog and send into it (always-new) ──────────────────
  // Shared by the draft branch of `sendMessage` and external launchers that
  // want a brand-new conversation regardless of what's currently active.
  const sendInNewDialog = useCallback(
    async (text: string, context?: MingoSendContext) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      const newId = await createDialog();
      if (!newId) return;
      addMessage(newId, {
        id: `welcome-${newId}`,
        role: 'assistant',
        name: 'Mingo',
        timestamp: new Date(),
        content: WELCOME_TEXT,
        assistantType: 'mingo',
      });
      setActiveDialogId(newId);
      resetUnread(newId);
      subscribeToDialog(newId);
      selectDialogMut(newId);
      // Mirror the standalone /mingo page: a successful send is a tracked
      // dashboard-activity event (relayed to HubSpot by the backend). This
      // covers every new-dialog send — draft composer, launcher prompts, and
      // quick-action chips — so the embeddable chat matches the page 1:1.
      const sent = await sendMingoMessage(trimmed, newId, context);
      if (sent) trackDashboardActivity(EVENT_SUBTYPE.SEND_MINGO_MESSAGE);
    },
    [createDialog, addMessage, setActiveDialogId, resetUnread, subscribeToDialog, selectDialogMut, sendMingoMessage],
  );

  // Snapshot the live navigation context (open view + recent views) from the
  // store and fold in the picker selection from the lib's send options. Read
  // imperatively (`getState`) so `sendMessage` doesn't re-create on every
  // navigation — it only needs the value at send time.
  const buildSendContext = useCallback((options?: UnifiedSendMessageOptions): MingoSendContext => {
    const { openView, recentViews } = useMingoContextStore.getState();
    return {
      // Defense-in-depth: hard-cap at the backend's contextItems limit (10) so a
      // selection that slipped past the picker's `atLimit` (e.g. the @-mention
      // path) can't 400 the whole message.
      contextItems: options?.contextItems?.slice(0, CONTEXT_ITEMS_MAX),
      openView: openView ? { type: openView.type, id: openView.id } : undefined,
      // Defense-in-depth: hard-cap at the backend's recentViews limit (5),
      // mirroring the contextItems cap above — a corrupted persisted store blob
      // with >5 entries must not 400 the whole message.
      recentViews: recentViews.slice(0, RECENT_VIEWS_MAX).map(r => ({ type: r.type, id: r.id })),
    };
  }, []);

  // ─── Send: create-on-first-send when no dialog is active (draft) ──────────
  // `options.contextItems` carries the composer's picker selection; the open
  // view + recent views come from the navigation store via `buildSendContext`.
  const sendMessage = useCallback(
    async (text: string, options?: UnifiedSendMessageOptions) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      const context = buildSendContext(options);

      if (!activeDialogId) {
        // The draft branch delegates to `sendInNewDialog`, which already fires
        // SEND_MINGO_MESSAGE on success — don't double-track here.
        await sendInNewDialog(trimmed, context);
        return;
      }

      // Existing-dialog send: track on success, same as the /mingo page's
      // active-dialog branch.
      const sent = await sendMingoMessage(trimmed, undefined, context);
      if (sent) trackDashboardActivity(EVENT_SUBTYPE.SEND_MINGO_MESSAGE);
    },
    [activeDialogId, sendInNewDialog, sendMingoMessage, buildSendContext],
  );

  const stopMessage = useCallback(() => {
    void stopGeneration();
  }, [stopGeneration]);

  // The store persists messages across switches for fast reopen — clearing the
  // open conversation just drops the selection back to the draft/list state.
  const clearMessages = useCallback(() => {
    setActiveDialogId(null);
  }, [setActiveDialogId]);

  const startNewDialog = useCallback(async (): Promise<string | null> => {
    setActiveDialogId(null);
    return null;
  }, [setActiveDialogId]);

  const loadMoreDialogs = useCallback(async () => {
    // No next-page fetches while the list query is in an error state: the
    // rail's infinite-scroll re-arms after EVERY attempt (that's what keeps a
    // shorter-than-viewport list auto-filling), so an unconditional fetch
    // here would hammer a failing backend in a tight retry loop. The 60s poll
    // or `reloadDialogs` clears the error and re-enables loading.
    if (isDialogsError) return;
    await fetchNextDialogPage();
  }, [isDialogsError, fetchNextDialogPage]);

  const loadMoreMessages = useCallback(async () => {
    await fetchNextMessagePage();
  }, [fetchNextMessagePage]);

  const approveRequest = useCallback(
    async (requestId: string) => {
      await handleApprove(requestId);
    },
    [handleApprove],
  );

  const rejectRequest = useCallback(
    async (requestId: string) => {
      await handleReject(requestId);
    },
    [handleReject],
  );

  const noopDialogAction = useCallback(async () => {}, []);
  const reloadDialogs = useCallback(() => {
    void refetchDialogs();
  }, [refetchDialogs]);
  // "Ask Mingo" from an inline entity card's ⋯ menu. The lib's SSE (guide)
  // transport narrows retrieval with a structured `entityIdFilter`; the agent
  // backend has no equivalent — its `ContextItemType` enum covers DEVICE /
  // SCRIPT / TICKET / ORGANIZATION / USER / KB_ARTICLE / POLICY / QUERY /
  // SCHEDULED_SCRIPT and no content types, so a roadmap item or release can't
  // ride `contextItems`. Until it can, the prompt carries the type + id as text
  // (`buildDiscussPrompt`'s `includeReference`) and the agent resolves the row
  // itself. Shared builder = the sentence matches guide mode word for word.
  const discussRef = useCallback(
    (reference: ChatRef) => {
      void sendMessage(buildDiscussPrompt(reference, { includeReference: true }));
    },
    [sendMessage],
  );
  const handleDisplayRef = useCallback(
    (reference: ChatRef) => {
      sendMingoDisplayCommand(reference, slashCommands, sendMessage);
    },
    [sendMessage, slashCommands],
  );
  const displayRef = hasMingoDisplayCommand(slashCommands) ? handleDisplayRef : undefined;

  const state = useMemo<UnifiedChatState>(
    () => ({
      messages,
      isLoading: isTyping || isCompacting,
      streamingPhase,
      sendMessage,
      stopMessage,
      clearMessages,
      discussRef,
      displayRef,
      // Per-turn LLM telemetry — Mingo surfaces cumulative dialog usage via the
      // `current*` fields so the composer's token tail matches the /mingo page
      // (usedTokens = totalTokensSize, contextWindow = contextSize).
      currentProvider: model?.provider ?? null,
      currentModelLabel: model?.displayName ?? null,
      currentContextWindowMaxTokens: tokenUsage?.contextSize ?? null,
      currentInputTokens: tokenUsage?.totalTokensSize ?? null,
      currentOutputTokens: null,
      currentCacheHitRatePct: null,
      currentUsageBreakdown: null,
      // Dialog management
      dialogs: dialogs as DialogItem[],
      activeDialogId,
      selectDialog,
      startNewDialog,
      deleteDialog: noopDialogAction,
      renameDialog,
      archiveDialog,
      // OR-ed with next-page fetches: react-query's `isLoading` covers only the
      // INITIAL load, so without `isFetchingNextPage` the lib's history list
      // never sees "loading more" (its `isLoadingMore` guard and the
      // infinite-scroll re-arm both key off it). With rows present the lib
      // derives `isLoadingMore`; with zero rows (empty "My Chats" scope while
      // auto-filling) it shows the skeleton instead of a premature empty state.
      isDialogsLoading: isLoadingDialogs || isFetchingNextDialogPage,
      dialogsError: false,
      reloadDialogs,
      isMessagesLoading: isLoadingMessages || isLoadingDialog,
      hasMoreDialogs: hasMoreDialogs ?? false,
      loadMoreDialogs,
      dialogScope,
      setDialogScope,
      hasMoreMessages: hasMoreMessages ?? false,
      loadMoreMessages,
      approveRequest,
      rejectRequest,
      dialogTokenUsage: tokenUsage,
      connectionState: connectionState as ChatConnectionState,
    }),
    [
      messages,
      isTyping,
      isCompacting,
      streamingPhase,
      sendMessage,
      stopMessage,
      clearMessages,
      discussRef,
      displayRef,
      model,
      tokenUsage,
      dialogs,
      activeDialogId,
      selectDialog,
      startNewDialog,
      noopDialogAction,
      renameDialog,
      archiveDialog,
      isLoadingDialogs,
      isFetchingNextDialogPage,
      reloadDialogs,
      isLoadingMessages,
      isLoadingDialog,
      hasMoreDialogs,
      loadMoreDialogs,
      dialogScope,
      hasMoreMessages,
      loadMoreMessages,
      approveRequest,
      rejectRequest,
      connectionState,
    ],
  );

  const subscription = useMemo<MingoSubscriptionBindings>(
    () => ({
      activeDialogId,
      isSubscribed: !!activeDialogId && subscribedDialogs.has(activeDialogId),
      onApprove: handleApprove,
      onReject: handleReject,
      approvalStatuses,
      onConnectionChange,
      onMetadata,
      initialOptStartSeq,
      isInitialOptStartSeqReady: isMessagesFetched,
    }),
    [
      activeDialogId,
      subscribedDialogs,
      handleApprove,
      handleReject,
      approvalStatuses,
      onConnectionChange,
      onMetadata,
      initialOptStartSeq,
      isMessagesFetched,
    ],
  );

  return {
    state,
    subscription,
    /** PENDING approval cards, lifted out of the thread by `useMingoChat` (it
     *  filters them from their bubble to dedupe an interrupted retry). They are
     *  displayed nowhere unless the host hands them to the chat's sticky
     *  footer, which is why they leave this hook separately from `state`. */
    pendingApprovals,
    sendInNewDialog,
    searchQuery,
    setSearchQuery,
    fetchArchivedDialogs,
    unarchiveDialog,
    dialogError,
  };
}
