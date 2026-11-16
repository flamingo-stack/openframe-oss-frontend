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
 * What stays the app's: the page context folded into every send (`snapshotSendContext`) and its analytics, the row
 * status at the end of each list row (`dialogStatusOf`), the link a dialog is copied as, Compact (the compaction
 * watchers report it), and the toasts of the dialog commands. Display, the faces of history rows, the list's refresh,
 * the record's re-read and the busy composer's release are the engine's (its config below).
 *
 * Call it in ONE place: `MingoChatProvider` runs it once per session through its runner; surfaces read the result
 * through `useMingoChatSurface()`, and the dock hands the engine to its panel (`ChatEngineProvider`). A second call is a
 * second dialog list and a second live tail.
 */

import { type MingoChatType, OPENFRAME_RECORD_KIND } from '@flamingo-stack/openframe-frontend-core/chat-protocol';
import {
  type ChatContextItem,
  type ChatEngineRefresh,
  type ChatHistoryBackend,
  type ChatTransport,
  createMingoGraphqlDialogs,
  createMingoGraphqlHistory,
  type DialogItem,
  jetStreamLiveTail,
  type MingoDialogStatus,
  type MingoGraphqlPost,
  type UnifiedChatState,
  type UnifiedSendMessageOptions,
  useChatEngine,
  useSlashCommandRegistry,
} from '@flamingo-stack/openframe-frontend-core/components/chat';
import { useChatRuntime } from '@flamingo-stack/openframe-frontend-core/contexts';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useMemo, useState } from 'react';
import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';
import { useMingoSheetStore } from '@/app/components/mingo-shell/mingo-sheet-store';
import { useAiModelStatus } from '@/app/hooks/use-ai-model';
import { useFeatureFlag } from '@/app/hooks/use-feature-flag';
import { isMobileViewportNow } from '@/app/hooks/use-is-mobile-viewport';
import { EVENT_SUBTYPE, trackDashboardActivity } from '@/lib/analytics';
import { apiClient } from '@/lib/api-client';
import { DISPLAY_APPROVAL_TYPES } from '@/lib/chat-approval-tiers';
import { featureFlags } from '@/lib/feature-flags';
import { getFullImageUrl } from '@/lib/image-url';
import { useNatsAppConfig } from '@/lib/nats/nats-app-config';
import { getQueryClient } from '@/lib/query-client';
import { mingoDialogLink } from '@/lib/routes';
import { runtimeEnv } from '@/lib/runtime-config';
import { sessionPollsAllowed } from '@/lib/session-poll';
import { linkedInsightId } from '../../incidents/utils/fix-with-mingo-draft';
import { CHAT_TYPE, type DialogIntent, NATS_TOPICS } from '../../tickets/constants';
import { ticketService } from '../../tickets/services';
import type { MessageListRef, MessagePageRef } from '../../tickets/services/ticket-service.types';
import type { GraphQlResponse } from '../../tickets/utils/graphql';
import { CONTEXT_ITEMS_MAX, RECENT_VIEWS_MAX } from '../context/context-types';
import { pageContextHref, resolvePageContext } from '../context/page-context';
import { useMingoCompactionStore } from '../stores/mingo-compaction-store';
import { useMingoContextStore } from '../stores/mingo-context-store';
import { noteMingoToolExecuted } from '../stores/mingo-created-entities-store';
import {
  type MingoDialogRow,
  nextMingoRowsTick,
  noteMingoDialogMissing,
  noteMingoDialogResponse,
  useMingoDialogRowsStore,
} from '../stores/mingo-dialog-rows-store';
import { mingoThreadStore } from '../stores/mingo-thread-store';
import { retryingRead } from '../utils/retrying-read';
import { useMingoDialogAutoRead } from './use-mingo-dialog-read';
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

/**
 * What the engine asks again: generated titles, row statuses and dialogs started elsewhere arrive with no event, and a
 * turn's end can be lost with the tail that carried it. Sooner while a fresh dialog waits for its generated title,
 * while the composer is locked, and while another chat of the viewer's is being answered (`expecting`): only the next
 * read shows that it ended and left a reply to read. A signed-out or hidden session asks nothing.
 */
const MINGO_REFRESH: ChatEngineRefresh = {
  intervalMs: 60_000,
  awaitingTitleMs: 10_000,
  expectingMs: 10_000,
  busyMs: 15_000,
  allowed: sessionPollsAllowed,
};

/**
 * One of the viewer's own chats is being answered. Another admin's chat leaves this viewer nothing to read, so it is
 * not worth the faster list.
 */
export function awaitsOwnReply(rows: ReadonlyMap<string, MingoDialogRow>, currentUserId: string | undefined): boolean {
  if (!currentUserId) return false;
  for (const row of rows.values()) {
    if (row.streaming && row.ownerUserId === currentUserId) return true;
  }
  return false;
}

/** A history row's author face, stored relative, as a full address. */
const avatarUrlOf = (stored: string) => getFullImageUrl(stored);

/**
 * One request to the ai-agent's `/chat/graphql`, as the lib's GraphQL readers post it. Every dialog node the answer
 * carries is noted for the list's rows (`noteMingoDialogResponse`), with the moment it was asked: an answer asked before
 * the viewer marked a chat read must not bring its unread replies back.
 *
 * An answer with data beside a failed sub-resolver is still the answer: only a field the server could not resolve at
 * all (null, with errors) rejects. Otherwise a flaky sub-resolver would read as "this dialog does not exist".
 */
export const postMingoGraphql: MingoGraphqlPost = async <T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<T> => {
  const askedAt = nextMingoRowsTick();
  const response = await apiClient.post<GraphQlResponse<Record<string, unknown>>>('/chat/graphql', {
    query,
    variables,
  });
  if (!response.ok) throw new Error(response.error || `Request failed with status ${response.status}`);
  const { data, errors } = response.data ?? {};
  const unresolved = !data || Object.values(data).some(value => value == null);
  if (errors?.length && unresolved) throw new Error(errors[0].message || 'GraphQL error occurred');
  if (!data) throw new Error('No data received from server');
  noteMingoDialogResponse(data, askedAt);
  return data as T;
};

/** Mingo's dialog list and its dialogs, read and kept with the lib's documents. */
export const mingoDialogs = createMingoGraphqlDialogs(postMingoGraphql, {
  agentTypes: ['ADMIN'],
  statuses: ACTIVE_DIALOG_STATUSES,
  chatType: ADMIN_CHAT_TYPE,
  pendingApproval: true,
  unread: true,
  imageUrlOf: image => getFullImageUrl(image.imageUrl, image.hash) ?? null,
});

/** The open dialog's history, a page at a time; a failed read tries again (`retryingRead`). */
const fetchMingoHistory = retryingRead(createMingoGraphqlHistory(postMingoGraphql, { chatType: ADMIN_CHAT_TYPE }));

/** The open dialog's record; a dialog that does not resolve is noted, so the app can tell "gone" from "failed". */
const fetchMingoDialog = retryingRead(async (dialogId: string) => {
  const record = await mingoDialogs.fetchDialog(dialogId);
  if (!record) noteMingoDialogMissing(dialogId);
  return record;
});

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

export interface MingoUnifiedChat {
  /** The engine's state, as `useChatEngine` returned it. */
  state: UnifiedChatState;
  /** The status at the end of a list row: working, waiting for approval, a reply nobody has read, or none. */
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
  // "Compact Chat Memory" while its flag is on; the compaction watchers report how it ended.
  const compactMemoryEnabled = useFeatureFlag('mingo-compact-memory');
  const startCompaction = useMingoCompactionStore(s => s.startCompaction);
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
        invalidateDialogLookups();
        toast({ title: 'Chat archived', variant: 'success' });
      },
      unarchiveDialog: async dialogId => {
        await mingoDialogs.unarchiveDialog(dialogId).catch(failed('Error', 'Failed to unarchive chat'));
        invalidateDialogLookups();
        toast({ title: 'Chat unarchived', variant: 'success' });
      },
      ...(compactMemoryEnabled
        ? {
            compactDialog: async (dialogId: string) => {
              if (!startCompaction(dialogId)) toast({ title: 'Already compacting this chat' });
            },
          }
        : {}),
    };
  }, [toast, appNamed, compactMemoryEnabled, startCompaction]);
}

/**
 * "Copy Chat Link": the dialog's canonical link on the clipboard, with toast feedback.
 *
 * `mingoDialogLink`, NOT the URL in the address bar: the live URL is `?mingoDialog=` riding whatever page the sharer is
 * on, so copying it would hand the recipient the sharer's screen. Absolute, because a link gets pasted somewhere this
 * app is not. The origin is the TENANT HOST, not `window.location.origin`: inside the native shells the latter is
 * `capacitor://localhost` or a `tauri://` origin, which nothing outside that install can resolve.
 */
function useCopyDialogLink(): (dialog: DialogItem) => void {
  const { toast } = useToast();
  return useMemo(
    () => (dialog: DialogItem) => {
      const origin = (runtimeEnv.tenantHostUrl() || window.location.origin).replace(/\/+$/, '');
      // A link that is not http(s) cannot travel: say so rather than put something unusable on the clipboard.
      if (!/^https?:\/\//.test(origin)) {
        toast({
          title: "Couldn't copy the link",
          description: 'This app does not know its workspace address yet.',
          variant: 'destructive',
        });
        return;
      }
      const url = `${origin}${mingoDialogLink(dialog.id)}`;
      void navigator.clipboard.writeText(url).then(
        () => toast({ title: 'Link copied', description: 'Anyone with access to this workspace can open it.' }),
        // Clipboard access is refused outside a secure context: showing the URL lets the reader select it by hand.
        () => toast({ title: "Couldn't copy the link", description: url, variant: 'destructive' }),
      );
    },
    [toast],
  );
}

/** `onScreen`: the open chat's thread is in front of the user (the provider counts the surfaces that show it). */
export function useMingoUnifiedChatState({ onScreen }: { onScreen: boolean }): MingoUnifiedChat {
  const { toast } = useToast();
  const { aiModel } = useAiModelStatus();
  const currentUserId = useAuthStore(s => s.user?.id);
  const expecting = useMingoDialogRowsStore(s => awaitsOwnReply(s.rows, currentUserId));
  const refresh = useMemo<ChatEngineRefresh>(() => ({ ...MINGO_REFRESH, expecting }), [expecting]);
  const transport = useMingoTransport();
  const history = useMingoHistory();
  const copyDialogLink = useCopyDialogLink();
  // The slash-command catalog (the same react-query entry `EmbeddableChat` reads): what a card's Display runs.
  const commandsUrl = useChatRuntime()?.endpoints.commandsUrl ?? '';
  const { commands: slashCommands } = useSlashCommandRegistry(commandsUrl, { enabled: Boolean(commandsUrl) });

  const state = useChatEngine({
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
    slashCommands,
    avatarUrlOf,
    copyDialogLink,
    refresh,
    // An approval the server refused (no AI budget left, already answered elsewhere): the card goes back to pending, and
    // the user is told why instead of facing the same buttons again.
    onActionError: (action, error) =>
      toast({
        title: action.startsWith('approve') ? 'Approval Failed' : 'Rejection Failed',
        description: error instanceof Error ? error.message : 'Unable to resolve request',
        variant: 'destructive',
        duration: 5000,
      }),
  });

  const { activeDialogId, messages, streamingPhase, isMessagesLoading } = state;
  const rows = useMingoDialogRowsStore(s => s.rows);
  const missing = useMingoDialogRowsStore(s => s.missing);

  const dialogStatusOf = useMingoDialogRowStatus({
    activeDialogId,
    phase: streamingPhase,
    messages,
    activeThreadLoaded: !isMessagesLoading,
    onScreen,
  });

  useMingoDialogAutoRead({
    dialogId: activeDialogId,
    currentUserId,
    onScreen,
    replyRunning: streamingPhase !== 'idle',
    readDialogAgain: mingoDialogs.fetchDialog,
  });

  return {
    state,
    dialogStatusOf,
    dialogNotFound: !!activeDialogId && missing.has(activeDialogId) && !!state.dialogError,
    dialogCreatedAt: activeDialogId ? (rows.get(activeDialogId)?.createdAt ?? null) : null,
  };
}
