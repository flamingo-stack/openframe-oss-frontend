'use client';

import type { DialogItem } from '@flamingo-stack/openframe-frontend-core';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';
import { apiClient } from '@/lib/api-client';
import { getFullImageUrl } from '@/lib/image-url';
import { sessionPollMeta, sessionPollsAllowed, sessionRetry } from '@/lib/session-poll';
import { extractGraphQlData } from '../../tickets/utils/graphql';
import { GET_MINGO_DIALOGS_WITH_PENDING_APPROVAL_QUERY } from '../queries/dialogs-queries';
import type { DialogNode, DialogsResponse, UseMingoDialogsOptions } from '../types';
import type { MingoDialogsPage } from '../utils/dialog-row-status';
import { keepCreatedDialogs } from '../utils/insert-new-dialog';
import { mingoDialogQueryKeys } from '../utils/query-keys';
import { isAwaitingGeneratedTitle } from './use-mingo-dialog-selection';

/**
 * The statuses the chat list shows. Sent explicitly because the backend
 * returns ARCHIVED dialogs too when no statuses are passed — the archive is
 * its own page.
 */
export const ACTIVE_DIALOG_STATUSES = ['ACTIVE', 'ACTION_REQUIRED', 'ON_HOLD', 'RESOLVED'] as const;

/** The chat lists' order: the chat with the latest message first. The cursor follows it. */
export const DIALOGS_BY_LAST_ACTIVITY = { field: 'lastActivityAt', direction: 'DESC' } as const;

/**
 * Dialogs one page of the Mingo list holds (`first:` of the dialogs query). The chat's conversation lists draw
 * exactly this many rows while the first page loads (`EmbeddableChat`'s `historyPageSize`).
 */
export const MINGO_DIALOGS_PAGE_SIZE = 20;

/** The list's poll while nothing in it is about to change. */
export const DIALOGS_POLL_MS = 60 * 1000;
/** The list's poll while a row is about to change with no event to say so. */
export const DIALOGS_FAST_POLL_MS = 10 * 1000;

/**
 * How soon the chat list is read again. Two changes reach it by poll alone, and both
 * are awaited by the person looking at the list, so it polls faster while one is due:
 * a title the backend is still generating, and the end of a reply in a chat of the
 * caller's own, which is when its row trades the working dots for the new-reply
 * glyph. Only the open chat is subscribed to its stream. Someone else's streaming
 * chat does not count: its row never shows the caller a new reply.
 */
export function dialogsPollInterval(
  pages: readonly MingoDialogsPage[] | undefined,
  currentUserId: string | undefined,
): number {
  const due = pages?.some(page =>
    page.dialogs.some(
      dialog =>
        isAwaitingGeneratedTitle(dialog) ||
        (dialog.streamState === 'STREAMING' && !!currentUserId && dialog.owner?.userId === currentUserId),
    ),
  );
  return due ? DIALOGS_FAST_POLL_MS : DIALOGS_POLL_MS;
}

/**
 * A dialog as the lib's list rows and header read it. Also the open conversation's
 * own record (`UnifiedChatState.activeDialog`), which is where the lib learns that a
 * conversation reached by link, notification or reload is archived.
 */
export function transformToDialogItem(dialog: DialogNode): DialogItem {
  // Admin owner → trailing avatar in the chat-history rows.
  // Client-owned dialogs (machine) carry no admin user — no avatar.
  const ownerUser = dialog.owner?.user;
  const ownerName = [ownerUser?.firstName, ownerUser?.lastName].filter(Boolean).join(' ');
  return {
    // Raw, not the global `id`: the lib uses `DialogItem.id` for selection, the
    // active-dialog check and the NATS subscription, all of which see raw ids.
    id: dialog.dialogId,
    // Read-only in the chat until restored. Never true for a row of the active
    // list (`ACTIVE_DIALOG_STATUSES`); it matters for the open conversation.
    archived: dialog.status === 'ARCHIVED',
    // The backend generates the title asynchronously after the first message;
    // until it lands the dialog has no title — show a provisional name, not an
    // error-looking "Untitled Dialog".
    title: dialog.title || 'New Chat',
    timestamp: new Date(dialog.lastActivityAt ?? dialog.createdAt),
    // Always 0: a row's unread reply is one of its statuses (`dialogRowStatus`), behind
    // the working dots and the approval it waits on, and never the open chat's. A count
    // here would let the lib draw it past all three.
    unreadMessagesCount: 0,
    owner: dialog.owner?.userId
      ? {
          // Who it is, not only what they are called: with the viewer's id the chat
          // lists tell someone else's chat apart (`currentUserId`).
          id: dialog.owner.userId,
          name: ownerName || 'Admin',
          avatarUrl: getFullImageUrl(ownerUser?.image?.imageUrl, ownerUser?.image?.hash) ?? null,
        }
      : undefined,
  };
}

export function useMingoDialogs(options: UseMingoDialogsOptions = {}) {
  const { enabled = true, search, limit = MINGO_DIALOGS_PAGE_SIZE, scope = 'all' } = options;
  const currentUserId = useAuthStore(state => state.user?.id);

  const query = useInfiniteQuery({
    // `scope` is part of the key: MY/ALL are different server-side datasets
    // with their own cursors, so they must not share cached pages.
    queryKey: mingoDialogQueryKeys.list({ search, limit, scope }),
    queryFn: async ({ pageParam }): Promise<MingoDialogsPage> => {
      const variables = {
        filter: {
          agentTypes: ['ADMIN'],
          statuses: ACTIVE_DIALOG_STATUSES,
          // Server-side ownership filter (ChatScope enum): MY = only the
          // signed-in admin's dialogs. Keeps cursor pages dense — no
          // client-side re-filtering needed.
          scope: scope === 'my' ? 'MY' : 'ALL',
        },
        first: limit,
        after: pageParam,
        search,
        sort: DIALOGS_BY_LAST_ACTIVITY,
      };

      // Each row's pending approval and unread replies ride along, for the row status.
      const { edges, pageInfo } = extractGraphQlData(
        await apiClient.post<DialogsResponse>('/chat/graphql', {
          query: GET_MINGO_DIALOGS_WITH_PENDING_APPROVAL_QUERY,
          variables,
        }),
      ).dialogs;
      const page = { dialogs: edges.map(edge => edge.node), pageInfo };
      // A dialog created moments ago may not be in the server's answer yet; the
      // first page of an unsearched list keeps it on top until it is.
      return pageParam === undefined && !search ? keepCreatedDialogs(page) : page;
    },
    getNextPageParam: lastPage => {
      return lastPage.pageInfo.hasNextPage ? lastPage.pageInfo.endCursor : undefined;
    },
    initialPageParam: undefined as string | undefined,
    enabled,
    // Keep the list cached for the session: a long staleTime means a remount (the
    // phone drawer's second instance, the chat search) doesn't refetch, and a long
    // gcTime keeps the data (no skeleton) while nothing shows it. Freshness comes
    // from the poll (`dialogsPollInterval`), the realtime subscription, and mutation
    // invalidations (rename/archive/new).
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: sessionRetry(3),
    meta: sessionPollMeta,
    refetchInterval: liveQuery => {
      if (!sessionPollsAllowed()) return false;
      return dialogsPollInterval(liveQuery.state.data?.pages, currentUserId);
    },
    // Keep the current list visible while a new `search` term refetches, so
    // typing doesn't flash an empty list / "No chats found" between keystrokes.
    placeholderData: keepPreviousData,
  });

  const nodes = useMemo(() => query.data?.pages.flatMap(page => page.dialogs) ?? [], [query.data]);
  const dialogs = useMemo(() => nodes.map(dialog => transformToDialogItem(dialog)), [nodes]);

  return {
    dialogs,
    /** The same rows as the server sent them: what a row's status is read from. */
    nodes,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error?.message,
    refetch: query.refetch,
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
  };
}
