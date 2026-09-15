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
  formatSingularLookupInvocation,
  sanitizeTitleForChat,
  useSlashCommandRegistry,
} from '@flamingo-stack/openframe-frontend-core/components/chat';
import { useChatRuntime } from '@flamingo-stack/openframe-frontend-core/contexts';
import { useCallback, useDeferredValue, useMemo, useState } from 'react';
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

/** Slash-command action that dumps a row's body into the chat verbatim. */
const DISPLAY_ACTION_ID = 'display';

/**
 * ProcessedMessage → UnifiedChatMessage.
 *
 * Destructure-and-spread, NOT a field-by-field rebuild. Every field the lib
 * stamps on a row and later reads back off it — `streamSeq`, `scrollAnchor`,
 * `hidden`, and Guide Mode V3's per-answer source/card/video metadata — rides
 * through `metadata` without this seam having to name it. A rebuild silently
 * drops whatever it does not list, and the drop is invisible: the message still
 * renders, just without the part the new field carried. Only the fields whose
 * SHAPE differs between the two types are handled explicitly below.
 */
export function mapMingoMessageToUnified(message: ProcessedMessage): UnifiedChatMessage {
  const { content, role: sourceRole, name, avatar, authorType, assistantType, contextItems, ...metadata } = message;

  // The lib folds 'error' into the assistant bubble and re-derives the assistant
  // identity (brand icon + "Mingo") itself, which is why `assistantType` is
  // destructured off rather than forwarded.
  const role: 'user' | 'assistant' = sourceRole === 'user' ? 'user' : 'assistant';

  // USER bubbles carry the real sender identity — the admin's name, avatar and
  // `authorType` (accent name colour) — so the drawer reads like the standalone
  // /mingo page instead of a hardcoded "You". A missing/Unknown name degrades to
  // the lib's own fallback.
  const identity =
    role === 'user' ? { name: name && name !== 'Unknown' ? name : undefined, avatar: avatar ?? null, authorType } : {};

  // Entity-context chips under a user bubble (Figma 1:6437). They ride the
  // optimistic send and the realtime MESSAGE_REQUEST echo; the lib resolves each
  // chip's icon from `contextPicker.entityTypes` by `type`.
  const context = role === 'user' && contextItems?.length ? { contextItems } : {};

  // Segment lists travel in `segments`; `content` must then be the empty string,
  // which is what tells the lib to render the structured form.
  const body = Array.isArray(content) ? { content: '', segments: content } : { content };

  return { ...metadata, role, ...body, ...identity, ...context };
}

function supportsDisplay(command: SlashCommandSummary): boolean {
  return command.actions.some(action => action.id === DISPLAY_ACTION_ID);
}

/**
 * The chat message that displays `reference`, or null when the catalog has no
 * command for it.
 *
 * Two table-id lookups, in priority order:
 *   1. `reference.sourceRepo` — Guide Mode V3, where the MCP metadata hands the
 *      registry table id back with the card, so no mapping is guessed;
 *   2. the lib's documentType→table map, for refs that carry no repo.
 *
 * Both are matched against `SlashCommandSummary.primarySourceId`, and only a
 * command that declares the `display` action counts — the others resolve the
 * same source but would run a search instead of dumping the row.
 */
export function buildMingoDisplayCommand(reference: ChatRef, commands: SlashCommandSummary[]): string | null {
  const tableIds = [reference.sourceRepo, defaultTableIdForDocumentType(reference.type)];
  const command = tableIds
    .filter((tableId): tableId is string => Boolean(tableId))
    .map(tableId => commands.find(candidate => candidate.primarySourceId === tableId && supportsDisplay(candidate)))
    .find((candidate): candidate is SlashCommandSummary => Boolean(candidate));
  if (!command) return null;

  // The slug is what the backend resolves fastest; the title is the V2 fallback
  // and the id the last resort, so a card with neither still opens something.
  const slug = typeof reference.metadata?.slug === 'string' ? reference.metadata.slug : '';
  const value = slug || sanitizeTitleForChat(reference.title) || reference.id;

  // `formatSingularLookupInvocation` is the SSOT for the quoting the backend's
  // slash parser consumes (it escapes `\` BEFORE `"`, so a value ending in a
  // backslash cannot smuggle the closing quote past the parser). The action word
  // rides in the command position because that IS the grammar the parser reads:
  // `/<cmd> display "<value>"`.
  return formatSingularLookupInvocation(`${command.id} ${DISPLAY_ACTION_ID}`, value);
}

/** Whether ANY command in the catalog can display a row — the gate on offering
 *  the affordance at all (see `displayRef` below). */
export function hasMingoDisplayCommand(commands: SlashCommandSummary[]): boolean {
  return commands.some(supportsDisplay);
}

export function useMingoUnifiedChatState(): MingoUnifiedChat {
  const { aiModel } = useAiModelStatus();

  // Same react-query entry `<EmbeddableChat>`'s onboarding-card list reads
  // (keyed on `commandsUrl` alone), so this adds no request of its own. What the
  // catalog contains is decided upstream by `chat-slash-command-visibility.ts`:
  // the full server-owned set under Guide Mode V3, the four V2 commands without it.
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
    isFetchingNextPage: isFetchingNextMessagePage,
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
  // The row-level mapping is `mapMingoMessageToUnified` (above, and unit-tested);
  // what lives here is only the CACHING around it.
  // `processedMessages` hands back referentially-stable objects for unchanged
  // messages (see useMingoChat's reconciliation), so keying a WeakMap by the
  // source object yields a stable UnifiedChatMessage too — the lib's reference-
  // equality memo then re-renders only the streaming bubble, not the whole list
  // (which would otherwise collapse open menus/cards on every chunk).
  // `useState`, not `useRef`: the map is read while rendering, and a ref read during
  // render is what the compiler bails out over. Same create-once identity.
  const [unifiedCache] = useState(() => new WeakMap<object, UnifiedChatMessage>());
  const messages = useMemo<UnifiedChatMessage[]>(() => {
    const cache = unifiedCache;
    return processedMessages.map(m => {
      const cached = cache.get(m);
      if (cached) return cached;
      const unified = mapMingoMessageToUnified(m);
      cache.set(m, unified);
      return unified;
    });
  }, [processedMessages, unifiedCache]);

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
  // Display dumps a row's raw body via a `/<cmd> display "<x>"` slash command.
  // Guide Mode V3 is what makes that reachable from Mingo: the agent resolves the
  // command through MCP `prompts/get` and forces the tool the prompt declares, so
  // the same catalog the composer autocompletes from is the one that runs here.
  const handleDisplayRef = useCallback(
    (reference: ChatRef) => {
      const text = buildMingoDisplayCommand(reference, slashCommands);
      if (!text) {
        console.warn(
          `[MingoChat] displayRef: no display command for type="${reference.type}" sourceRepo="${reference.sourceRepo}"; ignoring click`,
        );
        return;
      }
      void sendMessage(text);
    },
    [sendMessage, slashCommands],
  );
  // UNDEFINED, not a stub, while the catalog can't display anything: the lib gates
  // the affordance on this callback's presence, so a stub renders a dead "Display"
  // row where "Ask Mingo" (which works) belongs. Its type is optional for exactly
  // this case — which is also the V2 state, where the trimmed catalog has none.
  const displayRef: UnifiedChatState['displayRef'] = hasMingoDisplayCommand(slashCommands)
    ? handleDisplayRef
    : undefined;

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
      // OR-ed with next-page fetches, like `isDialogsLoading` above, because
      // the lib's message list takes this as its `isFetchingNextPage` — the
      // re-entrancy guard on the load-older sentinel AND the dependency that
      // re-creates its observer once a page lands. Without it a second
      // intersection mid-fetch re-issued `fetchNextPage` (which cancels the one
      // in flight), and a page landing with the sentinel still in view never
      // re-armed — older history looked gone.
      isMessagesLoading: isLoadingMessages || isLoadingDialog || isFetchingNextMessagePage,
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
      isFetchingNextMessagePage,
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
