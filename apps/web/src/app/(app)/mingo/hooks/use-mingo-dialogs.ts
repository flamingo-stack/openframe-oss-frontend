'use client';

import { type DialogItem, useOptionalNotifications } from '@flamingo-stack/openframe-frontend-core';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
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

// TODO(unread-from-entity): re-enable per-dialog unread highlighting once the backend exposes
// unread counts on the dialog entity itself. Matching unread notifications to dialogs by id is a
// temporary workaround — disabled for now; flip this flag to restore it.
const HIGHLIGHT_UNREAD_FROM_NOTIFICATIONS: boolean = false;

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

/**
 * A dialog as the lib's list rows and header read it. Also the open conversation's
 * own record (`UnifiedChatState.activeDialog`), which is where the lib learns that a
 * conversation reached by link, notification or reload is archived.
 */
export function transformToDialogItem(dialog: DialogNode, unreadCount: number = 0): DialogItem {
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
    unreadMessagesCount: unreadCount,
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
  const notifications = useOptionalNotifications();
  // Per-dialog unread badge = count of unread notifications (mingo message / approval request)
  // that carry this dialog's id. Opening a dialog marks those read (EntityViewAutoReader),
  // which clears the badge in lockstep with the sidebar nav count.
  const unreadByDialog = useMemo(() => {
    const counts = new Map<string, number>();
    if (!HIGHLIGHT_UNREAD_FROM_NOTIFICATIONS) return counts;
    for (const notification of notifications?.notifications ?? []) {
      if (notification.read) continue;
      const dialogId = notification.meta?.dialogId;
      if (typeof dialogId === 'string') counts.set(dialogId, (counts.get(dialogId) ?? 0) + 1);
    }
    return counts;
  }, [notifications?.notifications]);

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

      // Each row's pending approval rides along, for the row status.
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
    // from the 60s poll, the realtime subscription, and mutation invalidations
    // (rename/archive/new).
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: sessionRetry(3),
    meta: sessionPollMeta,
    // Titles are generated asynchronously on the backend with no realtime
    // event — while the list holds a fresh title-less dialog ("New Chat"),
    // poll faster so the generated title replaces it promptly.
    refetchInterval: liveQuery => {
      if (!sessionPollsAllowed()) return false;
      const pages = liveQuery.state.data?.pages;
      const awaitingTitle = pages?.some(page => page.dialogs.some(dialog => isAwaitingGeneratedTitle(dialog)));
      return awaitingTitle ? 10 * 1000 : 60 * 1000;
    },
    // Keep the current list visible while a new `search` term refetches, so
    // typing doesn't flash an empty list / "No chats found" between keystrokes.
    placeholderData: keepPreviousData,
  });

  const nodes = useMemo(() => query.data?.pages.flatMap(page => page.dialogs) ?? [], [query.data]);
  const dialogsWithUnread = useMemo(
    () => nodes.map(dialog => transformToDialogItem(dialog, unreadByDialog.get(dialog.dialogId) ?? 0)),
    [nodes, unreadByDialog],
  );

  return {
    dialogs: dialogsWithUnread,
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
