'use client';

/**
 * useMingoUnifiedChatState: Mingo on the lib's chat engine (`useChatEngine`), the one web chat every app runs. This
 * file is the engine's configuration for OpenFrame's operator chat and nothing else:
 *
 *   transport  the JetStream live tail of the dialog's `admin-message` subject (it replays a gap and drops a redelivery
 *              itself), and the ai-agent's send / stop / approve / reject commands;
 *   history    the dialog list, the open dialog's record and its pages, read and kept with the lib's GraphQL documents
 *              (`createMingoGraphqlDialogs`, `createMingoGraphqlHistory`);
 *   store      `mingoThreadStore`, module-level, so a chat reopened mid-turn shows the turn.
 *
 * What stays the app's: the page context folded into every send (`snapshotSendContext`) and its analytics, the
 * slash-command display action (`displayRef`), the row status at the end of each list row (`dialogStatusOf`), the
 * list's refresh timer, and the toasts of the dialog commands.
 *
 * Call it in ONE place: `MingoChatProvider` runs it once per session through its runner; surfaces read the result
 * through `useMingoChatSurface()`. A second call is a second dialog list and a second live tail.
 */

import {
  type ChatMessage,
  type MingoChatType,
  OPENFRAME_RECORD_KIND,
} from '@flamingo-stack/openframe-frontend-core/chat-protocol';
import {
  type ChatContextItem,
  type ChatHistoryBackend,
  type ChatRef,
  type ChatTransport,
  createMingoGraphqlDialogs,
  createMingoGraphqlHistory,
  defaultTableIdForDocumentType,
  type DialogItem,
  formatSingularLookupInvocation,
  jetStreamLiveTail,
  type MingoDialogStatus,
  type MingoGraphqlPost,
  sanitizeTitleForChat,
  type SlashCommandSummary,
  threadForDisplay,
  type UnifiedChatState,
  type UnifiedSendMessageOptions,
  useChatEngine,
  useSlashCommandRegistry,
} from '@flamingo-stack/openframe-frontend-core/components/chat';
import { useChatRuntime } from '@flamingo-stack/openframe-frontend-core/contexts';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';
import { useMingoSheetStore } from '@/app/components/mingo-shell/mingo-sheet-store';
import { useAiModelStatus } from '@/app/hooks/use-ai-model';
import { isMobileViewportNow } from '@/app/hooks/use-is-mobile-viewport';
import { EVENT_SUBTYPE, trackDashboardActivity } from '@/lib/analytics';
import { apiClient } from '@/lib/api-client';
import { DISPLAY_APPROVAL_TYPES } from '@/lib/chat-approval-tiers';
import { featureFlags } from '@/lib/feature-flags';
import { getFullImageUrl } from '@/lib/image-url';
import { useNatsAppConfig } from '@/lib/nats/nats-app-config';
import { getQueryClient } from '@/lib/query-client';
import { sessionPollsAllowed } from '@/lib/session-poll';
import { linkedInsightId } from '../../incidents/utils/fix-with-mingo-draft';
import { CHAT_TYPE, type DialogIntent, NATS_TOPICS } from '../../tickets/constants';
import { ticketService } from '../../tickets/services';
import type { MessageListRef, MessagePageRef } from '../../tickets/services/ticket-service.types';
import type { GraphQlResponse } from '../../tickets/utils/graphql';
import { CONTEXT_ITEMS_MAX, RECENT_VIEWS_MAX } from '../context/context-types';
import { pageContextHref, resolvePageContext } from '../context/page-context';
import { useMingoContextStore } from '../stores/mingo-context-store';
import { noteMingoToolExecuted } from '../stores/mingo-created-entities-store';
import {
  isAwaitingGeneratedTitle,
  noteMingoDialogArchived,
  noteMingoDialogMissing,
  noteMingoDialogResponse,
  noteMingoDialogRestored,
  useMingoDialogRowsStore,
} from '../stores/mingo-dialog-rows-store';
import { mingoThreadStore } from '../stores/mingo-thread-store';
import { useMingoDialogRowStatus } from './use-mingo-dialog-row-status';

const ADMIN_CHAT_TYPE: MingoChatType = 'ADMIN_AI_CHAT';

const WELCOME_TEXT = "Hi! I'm Mingo AI, ready to help with your technical tasks. What can I do for you?";

/**
 * The statuses the chat list shows. Sent explicitly because the backend returns ARCHIVED dialogs too when no statuses
 * are passed: the archive is its own page.
 */
export const ACTIVE_DIALOG_STATUSES = ['ACTIVE', 'ACTION_REQUIRED', 'ON_HOLD', 'RESOLVED'] as const;

/** Dialogs one page of the Mingo list holds: the conversation lists draw this many rows while it loads. */
export const MINGO_DIALOGS_PAGE_SIZE = 20;

/** How often the list is asked again: titles, row statuses and dialogs started elsewhere arrive with no event. */
const LIST_REFRESH_MS = 60_000;
/** Sooner while a fresh dialog waits for its generated title. */
const TITLE_REFRESH_MS = 10_000;

/**
 * One request to the ai-agent's `/chat/graphql`, as the lib's GraphQL readers post it. Every dialog node the answer
 * carries is noted for the list's rows (`noteMingoDialogResponse`).
 *
 * An answer with data beside a failed sub-resolver is still the answer: only a field the server could not resolve at
 * all (null, with errors) rejects. Otherwise a flaky sub-resolver would read as "this dialog does not exist".
 */
export const postMingoGraphql: MingoGraphqlPost = async <T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<T> => {
  const response = await apiClient.post<GraphQlResponse<Record<string, unknown>>>('/chat/graphql', {
    query,
    variables,
  });
  if (!response.ok) throw new Error(response.error || `Request failed with status ${response.status}`);
  const { data, errors } = response.data ?? {};
  const unresolved = !data || Object.values(data).some(value => value == null);
  if (errors?.length && unresolved) throw new Error(errors[0].message || 'GraphQL error occurred');
  if (!data) throw new Error('No data received from server');
  noteMingoDialogResponse(data);
  return data as T;
};

/** Mingo's dialog list and its dialogs, read and kept with the lib's documents. */
export const mingoDialogs = createMingoGraphqlDialogs(postMingoGraphql, {
  agentTypes: ['ADMIN'],
  statuses: ACTIVE_DIALOG_STATUSES,
  chatType: ADMIN_CHAT_TYPE,
  pendingApproval: true,
  imageUrlOf: image => getFullImageUrl(image.imageUrl, image.hash) ?? null,
});

const fetchMingoHistory = createMingoGraphqlHistory(postMingoGraphql, { chatType: ADMIN_CHAT_TYPE });

/** The open dialog's record; a dialog that does not resolve is noted, so the app can tell "gone" from "failed". */
async function fetchMingoDialog(dialogId: string) {
  const record = await mingoDialogs.fetchDialog(dialogId);
  if (!record) noteMingoDialogMissing(dialogId);
  return record;
}

/** What a Mingo message carries besides its text. */
export interface MingoSendContext {
  contextItems?: ChatContextItem[];
  openView?: { type: string; id: string } | null;
  recentViews?: Array<{ type: string; id: string }>;
  currentPage?: MessagePageRef;
  currentList?: MessageListRef;
}

/**
 * What a Mingo message carries besides its text, as it stands when it is sent: the page (read from the URL: under the
 * sheet, the page beneath it; on the chat page, the page it was opened from), the open view and recent views from the
 * navigation store, and the picker's selection from the lib's send options. Read imperatively (`getState`) so a send
 * does not re-create on every navigation.
 */
export function snapshotSendContext(options?: UnifiedSendMessageOptions): MingoSendContext {
  const { openView, recentViews } = useMingoContextStore.getState();
  const { lastPage, newChatPage } = useMingoSheetStore.getState();
  // On a phone the home and a chat started there are about the page the new chat was started over.
  const href = pageContextHref(window.location, lastPage, isMobileViewportNow() ? { newChatPage } : undefined);
  return {
    ...resolvePageContext(href, openView),
    // Hard-capped at the backend's limits (10 context items, 5 recent views): a selection that slipped past the
    // picker's `atLimit` (the @-mention path), or a corrupted persisted store, must not 400 the whole message.
    contextItems: options?.contextItems?.slice(0, CONTEXT_ITEMS_MAX),
    openView: openView ? { type: openView.type, id: openView.id } : undefined,
    recentViews: recentViews.slice(0, RECENT_VIEWS_MAX).map(r => ({ type: r.type, id: r.id })),
  };
}

/** A chat whose first message references an incident is listed under it: the attached incident, else its record link. */
function insightIdOf(options: UnifiedSendMessageOptions | undefined, firstMessage: string | undefined) {
  return (
    options?.contextItems?.find(item => item.type === OPENFRAME_RECORD_KIND.INSIGHT)?.id ??
    (firstMessage ? linkedInsightId(firstMessage) : undefined)
  );
}

/** Slash-command action that dumps a row's body into the chat verbatim. */
const DISPLAY_ACTION_ID = 'display';

function supportsDisplay(command: SlashCommandSummary): boolean {
  return command.actions.some(action => action.id === DISPLAY_ACTION_ID);
}

/**
 * The chat message that displays `reference`, or null when the catalog has no command for it.
 *
 * Two table-id lookups, in priority order: `reference.sourceRepo`, when a row knows its table, then the lib's
 * documentType to table map. Both are matched against `SlashCommandSummary.primarySourceId`, and only a command that
 * declares the `display` action counts: the others resolve the same source but would run a search instead.
 */
export function buildMingoDisplayCommand(reference: ChatRef, commands: SlashCommandSummary[]): string | null {
  const tableIds = [reference.sourceRepo, defaultTableIdForDocumentType(reference.type)];
  const command = tableIds
    .filter((tableId): tableId is string => Boolean(tableId))
    .map(tableId => commands.find(candidate => candidate.primarySourceId === tableId && supportsDisplay(candidate)))
    .find((candidate): candidate is SlashCommandSummary => Boolean(candidate));
  if (!command) return null;

  // The slug is what the backend resolves fastest; the title the fallback and the id the last resort.
  const slug = typeof reference.metadata?.slug === 'string' ? reference.metadata.slug : '';
  const value = slug || sanitizeTitleForChat(reference.title) || reference.id;

  // `formatSingularLookupInvocation` owns the quoting the backend's slash parser reads: `/<cmd> display "<value>"`.
  return formatSingularLookupInvocation(`${command.id} ${DISPLAY_ACTION_ID}`, value);
}

/** Whether ANY command in the catalog can display a row: the gate on offering the affordance at all. */
export function hasMingoDisplayCommand(commands: SlashCommandSummary[]): boolean {
  return commands.some(supportsDisplay);
}

/** A row's author face as a full address: history rows carry the stored, relative one. One object per row. */
const withFullAvatarCache = new WeakMap<ChatMessage, ChatMessage>();
function withFullAvatar(message: ChatMessage): ChatMessage {
  const cached = withFullAvatarCache.get(message);
  if (cached) return cached;
  const author = message.metadata?.author;
  const avatar = getFullImageUrl(author?.avatar);
  const resolved =
    !author?.avatar || !avatar || avatar === author.avatar
      ? message
      : { ...message, metadata: { ...message.metadata, author: { ...author, avatar } } };
  withFullAvatarCache.set(message, resolved);
  return resolved;
}

export interface MingoUnifiedChat {
  /** The engine's state, with this host's display action. */
  state: UnifiedChatState;
  /** The status at the end of a list row: working, waiting for approval, or none. */
  dialogStatusOf: (dialog: DialogItem) => MingoDialogStatus | undefined;
  /** The open dialog's record answered that it does not exist for this viewer (deleted, someone else's, mistyped). */
  dialogNotFound: boolean;
  /** When the open dialog was created (its record), or null until read. */
  dialogCreatedAt: string | null;
}

/** The ai-agent's commands, for the dialog the engine names. */
function useMingoTransport(): ChatTransport {
  const { getWsUrl, onBeforeReconnect } = useNatsAppConfig();
  return useMemo<ChatTransport>(
    () => ({
      replays: true,
      useLiveTail: jetStreamLiveTail({
        getNatsWsUrl: getWsUrl,
        topic: NATS_TOPICS.ADMIN_MESSAGE,
        onBeforeReconnect,
      }),
      publish: async (text, options) => {
        if (!options.dialogId) return false;
        const { contextItems, openView, recentViews, currentPage, currentList } = snapshotSendContext(options);
        await ticketService.sendMessage(options.dialogId, text.trim(), CHAT_TYPE.ADMIN, {
          contextItems: contextItems?.map(item => ({ type: item.type, id: item.id })),
          currentView: openView ?? undefined,
          recentViews,
          currentPage,
          currentList,
        });
        // A successful send is a tracked dashboard-activity event (relayed to HubSpot by the backend).
        trackDashboardActivity(EVENT_SUBTYPE.SEND_MINGO_MESSAGE);
        return true;
      },
      stop: dialogId => ticketService.stopDialogGeneration(dialogId, CHAT_TYPE.ADMIN),
      approve: async requestId => {
        await ticketService.resolveApprovalRequest(requestId, true);
        trackDashboardActivity(EVENT_SUBTYPE.APPROVE_MINGO_COMMAND);
      },
      reject: async requestId => {
        await ticketService.resolveApprovalRequest(requestId, false);
        trackDashboardActivity(EVENT_SUBTYPE.REJECT_MINGO_COMMAND);
      },
    }),
    [getWsUrl, onBeforeReconnect],
  );
}

/** The lookups every dialog command can move: the incidents' "reopen" chats and the approvals inbox. */
function invalidateDialogLookups(): void {
  void getQueryClient().invalidateQueries({ queryKey: ['mingo-dialogs'] });
}

/** Mingo's dialog list and dialogs, with the toasts a person sees for each command. */
function useMingoHistory(): ChatHistoryBackend {
  const { toast } = useToast();
  // A title the app gives a dialog it creates (the Getting Started tour) is not the person's rename: no toast.
  const [appNamed] = useState(() => new Set<string>());
  return useMemo<ChatHistoryBackend>(() => {
    const failed = (title: string, fallback: string) => (error: unknown) => {
      toast({ title, description: error instanceof Error ? error.message : fallback, variant: 'destructive' });
      throw error;
    };
    return {
      fetchDialogs: mingoDialogs.fetchDialogs,
      fetchArchivedDialogs: mingoDialogs.fetchArchivedDialogs,
      fetchDialog: fetchMingoDialog,
      fetchDialogMessages: fetchMingoHistory,
      createDialog: async ({ title, intent, sendOptions, firstMessage }) => {
        try {
          const insightId = insightIdOf(sendOptions, firstMessage);
          const dialogId = await ticketService.createDialog({
            agentType: 'ADMIN',
            ...(insightId ? { insightId } : {}),
            ...(intent ? { intent: intent as DialogIntent } : {}),
          });
          if (title) appNamed.add(dialogId);
          invalidateDialogLookups();
          return { dialogId };
        } catch (error) {
          return failed('Failed to start conversation', 'Could not create a new chat')(error);
        }
      },
      renameDialog: async (dialogId, title) => {
        const silent = appNamed.delete(dialogId);
        await mingoDialogs.renameDialog(dialogId, title).catch(failed('Error', 'Failed to rename chat'));
        invalidateDialogLookups();
        if (!silent) toast({ title: 'Chat renamed', variant: 'success' });
      },
      archiveDialog: async dialogId => {
        await mingoDialogs.archiveDialog(dialogId).catch(failed('Error', 'Failed to archive chat'));
        noteMingoDialogArchived(dialogId);
        invalidateDialogLookups();
        toast({ title: 'Chat archived', variant: 'success' });
      },
      unarchiveDialog: async dialogId => {
        await mingoDialogs.unarchiveDialog(dialogId).catch(failed('Error', 'Failed to unarchive chat'));
        noteMingoDialogRestored(dialogId);
        invalidateDialogLookups();
        toast({ title: 'Chat unarchived', variant: 'success' });
      },
    };
  }, [toast, appNamed]);
}

/**
 * The list asked again on a timer: generated titles, row statuses and dialogs started elsewhere arrive with no event.
 * The first page is read on its own and noted for the rows; the engine's list reloads only when that page holds a
 * dialog it does not, and only while it shows no more than that page (a reload would drop the pages read past it).
 */
function useMingoListRefresh(state: UnifiedChatState): void {
  const { dialogs, reloadDialogs, dialogScope } = state;
  const search = state.dialogCapabilities?.searchQuery || undefined;
  const rows = useMingoDialogRowsStore(s => s.rows);
  const awaitingTitle = dialogs.some(dialog => isAwaitingGeneratedTitle(rows.get(dialog.id)));
  const onFirstPage = dialogs.length <= MINGO_DIALOGS_PAGE_SIZE;
  const knownIds = dialogs.map(dialog => dialog.id).join(',');
  useEffect(() => {
    const known = new Set(knownIds ? knownIds.split(',') : []);
    let current = true;
    const timer = setInterval(
      () => {
        if (!sessionPollsAllowed()) return;
        void mingoDialogs
          .fetchDialogs({ limit: MINGO_DIALOGS_PAGE_SIZE, search, ...(dialogScope ? { scope: dialogScope } : {}) })
          .then(page => {
            if (current && onFirstPage && page.dialogs.some(dialog => !known.has(dialog.id))) reloadDialogs();
          })
          .catch(() => {
            // The next tick asks again; the list on screen stays as it is.
          });
      },
      awaitingTitle ? TITLE_REFRESH_MS : LIST_REFRESH_MS,
    );
    return () => {
      current = false;
      clearInterval(timer);
    };
  }, [knownIds, onFirstPage, awaitingTitle, search, dialogScope, reloadDialogs]);
}

export function useMingoUnifiedChatState(): MingoUnifiedChat {
  const { aiModel } = useAiModelStatus();
  const currentUserId = useAuthStore(s => s.user?.id);
  const transport = useMingoTransport();
  const history = useMingoHistory();

  const engine = useChatEngine({
    transport,
    history,
    store: mingoThreadStore,
    dialogScopes: true,
    ...(currentUserId ? { currentUserId } : {}),
    displayApprovalTypes: DISPLAY_APPROVAL_TYPES,
    chatTypeFilter: ADMIN_CHAT_TYPE,
    dialogsPageSize: MINGO_DIALOGS_PAGE_SIZE,
    newDialogGreeting: WELCOME_TEXT,
    modelProvider: aiModel?.provider ?? null,
    modelLabel: aiModel?.displayName ?? null,
    // A create Mingo just ran adds a row to a list the page behind the chat may show.
    transformChunk: raw => {
      noteMingoToolExecuted(raw as Parameters<typeof noteMingoToolExecuted>[0]);
      return raw;
    },
    debug: () => featureFlags.debugNatsChunks.enabled(),
  });

  useMingoListRefresh(engine);

  const { activeDialogId, messages: thread, streamingPhase, isMessagesLoading, sendMessage } = engine;
  const rows = useMingoDialogRowsStore(s => s.rows);
  const missing = useMingoDialogRowsStore(s => s.missing);
  const restored = useMingoDialogRowsStore(s => s.restored);

  const dialogStatusOf = useMingoDialogRowStatus({
    activeDialogId,
    phase: streamingPhase,
    messages: thread,
    activeThreadLoaded: !isMessagesLoading,
  });

  // The slash-command catalog (the same react-query entry `EmbeddableChat` reads): what `displayRef` can run.
  const commandsUrl = useChatRuntime()?.endpoints.commandsUrl ?? '';
  const { commands: slashCommands } = useSlashCommandRegistry(commandsUrl, { enabled: Boolean(commandsUrl) });

  // UNDEFINED, not a stub, while the catalog can display nothing: the lib gates the affordance on its presence.
  const displayRef = useMemo<UnifiedChatState['displayRef']>(() => {
    if (!hasMingoDisplayCommand(slashCommands)) return undefined;
    return (reference: ChatRef) => {
      const text = buildMingoDisplayCommand(reference, slashCommands);
      if (!text) {
        console.warn(
          `[MingoChat] displayRef: no display command for type="${reference.type}" sourceRepo="${reference.sourceRepo}"; ignoring click`,
        );
        return;
      }
      void sendMessage(text);
    };
  }, [slashCommands, sendMessage]);

  // The thread as a view draws it (one copy of each card), each row's face a full address.
  const messages = useMemo(() => threadForDisplay(thread).map(withFullAvatar), [thread]);

  // The list rows and the open dialog's record name what the server last said, which the timer refreshes: a title
  // generated since, a dialog restored from the archive here.
  const engineDialogs = engine.dialogs;
  const dialogs = useMemo(
    () =>
      engineDialogs.map(dialog => {
        const title = rows.get(dialog.id)?.title;
        return title && title !== dialog.title ? { ...dialog, title } : dialog;
      }),
    [engineDialogs, rows],
  );
  const record = engine.activeDialog ?? null;
  const freshTitle = record ? rows.get(record.id)?.title : undefined;
  const isRestored = record ? restored.has(record.id) : false;
  const activeDialog = useMemo(() => {
    if (!record) return null;
    const retitled = !!freshTitle && freshTitle !== record.title;
    const unarchived = isRestored && !!record.archived;
    if (!retitled && !unarchived) return record;
    return { ...record, ...(retitled ? { title: freshTitle } : {}), ...(unarchived ? { archived: false } : {}) };
  }, [record, freshTitle, isRestored]);

  const state = useMemo<UnifiedChatState>(
    () => ({ ...engine, messages, dialogs, activeDialog, displayRef }),
    [engine, messages, dialogs, activeDialog, displayRef],
  );

  return {
    state,
    dialogStatusOf,
    dialogNotFound: !!activeDialogId && missing.has(activeDialogId) && !!engine.dialogError,
    dialogCreatedAt: activeDialogId ? (rows.get(activeDialogId)?.createdAt ?? null) : null,
  };
}
