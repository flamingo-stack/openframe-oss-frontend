'use client';

import type { DialogItem, MingoDialogStatus } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { type InfiniteData, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useMingoMessagesStore } from '../stores/mingo-messages-store';
import type { DialogNode } from '../types';
import {
  dialogRowStatus,
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
}

/**
 * The status at the end of each chat list row: working, waiting for approval, or
 * none (the lib then shows unread replies).
 *
 * Only the open chat is subscribed to its stream, so it answers from its own phase
 * and thread; every other row from the list query (`streamState`,
 * `pendingApproval`), which polls. The open chat's live state is also written onto
 * its list row, so leaving it mid-answer or with an approval pending keeps the
 * glyph until the next poll says otherwise.
 */
export function useMingoDialogRowStatus({
  activeDialogId,
  nodes,
  activeThreadLoaded,
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

  return dialog => {
    if (live && dialog.id === activeDialogId) return dialogRowStatus(live);
    const node = nodes.find(row => row.id === dialog.id);
    return node ? dialogRowStatus(serverRowState(node)) : undefined;
  };
}
