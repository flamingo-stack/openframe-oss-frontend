'use client';

import type { DialogItem, MingoDialogStatus } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { type InfiniteData, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useMingoMessagesStore } from '../stores/mingo-messages-store';
import type { DialogNode } from '../types';
import {
  dialogRowStatus,
  hasUnreadReply,
  liveRowState,
  type MingoDialogsPage,
  serverRowState,
  withLiveRowState,
} from '../utils/dialog-row-status';
import { mingoDialogQueryKeys } from '../utils/query-keys';

interface UseMingoDialogRowStatusOptions {
  activeDialogId: string | null;
  /** The chat list rows as the server sent them. */
  nodes: readonly DialogNode[];
  /** The open chat's history has loaded; before that its thread says nothing yet. */
  activeThreadLoaded: boolean;
  /**
   * The open chat's thread is in front of the user (the provider's `onScreen`). The
   * open chat is not always: its tail keeps running behind a full-screen page.
   */
  onScreen: boolean;
}

/**
 * The status at the end of each chat list row: working, waiting for approval, a
 * reply nobody has read, or none.
 *
 * Only the open chat is subscribed to its stream, so it answers from its own phase
 * and thread; every other row from the list query (`streamState`,
 * `pendingApproval`), which polls. The open chat's live state is also written onto
 * its list row, so leaving it mid-answer or with an approval pending keeps the
 * glyph until the next poll says otherwise.
 *
 * An unread reply is the list row's (`unreadMessageCount`) for every chat but the
 * one on screen, which never shows it: its reader is looking at the reply, from the
 * moment the chat is selected and before the read mark has reached the server.
 */
export function useMingoDialogRowStatus({
  activeDialogId,
  nodes,
  activeThreadLoaded,
  onScreen,
}: UseMingoDialogRowStatusOptions): (dialog: DialogItem) => MingoDialogStatus | undefined {
  const queryClient = useQueryClient();
  const activePhase = useMingoMessagesStore(s => (activeDialogId ? s.phaseByDialog.get(activeDialogId) : undefined));
  const activeMessages = useMingoMessagesStore(s =>
    activeDialogId ? s.messagesByDialog.get(activeDialogId) : undefined,
  );
  const live =
    activeDialogId && activeThreadLoaded && activePhase && activeMessages
      ? liveRowState(activePhase, activeMessages)
      : null;

  const liveStreaming = live?.streaming;
  const liveAwaiting = live?.awaitingApproval;
  const liveRequestId = live?.approvalRequestId;
  useEffect(() => {
    if (!activeDialogId || liveStreaming === undefined || liveAwaiting === undefined) return;
    const state = { streaming: liveStreaming, awaitingApproval: liveAwaiting, approvalRequestId: liveRequestId };
    queryClient.setQueriesData<InfiniteData<MingoDialogsPage>>({ queryKey: mingoDialogQueryKeys.lists }, data =>
      withLiveRowState(data, activeDialogId, state),
    );
  }, [queryClient, activeDialogId, liveStreaming, liveAwaiting, liveRequestId]);

  // What the returned function closes over decides when the list re-renders, so it is
  // the open row's status, a string, never `live`: that object is new with every
  // streamed chunk, and a function keyed on it re-rendered every history row (in the
  // sidebar and the phone drawer) once per chunk. The other rows are looked up once
  // per list, not searched per row.
  const openNode = activeDialogId ? nodes.find(row => row.dialogId === activeDialogId) : undefined;
  const openRowState = live ?? (openNode ? serverRowState(openNode) : null);
  const openRowUnread = !onScreen && !!openNode && hasUnreadReply(openNode);
  const openRowStatus = openRowState ? dialogRowStatus(openRowState, openRowUnread) : undefined;
  const statusByDialogId = new Map(
    nodes.map(row => [row.dialogId, dialogRowStatus(serverRowState(row), hasUnreadReply(row))]),
  );
  return dialog => (dialog.id === activeDialogId ? openRowStatus : statusByDialogId.get(dialog.id));
}
