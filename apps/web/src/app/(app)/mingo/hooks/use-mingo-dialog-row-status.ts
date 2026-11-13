'use client';

import type { ChatMessage } from '@flamingo-stack/openframe-frontend-core/chat-protocol';
import type {
  DialogItem,
  MingoDialogStatus,
  StreamingPhase,
} from '@flamingo-stack/openframe-frontend-core/components/chat';
import { useEffect } from 'react';
import { noteMingoLiveRow, useMingoDialogRowsStore } from '../stores/mingo-dialog-rows-store';
import { dialogRowStatus, liveRowState } from '../utils/dialog-row-status';

interface UseMingoDialogRowStatusOptions {
  activeDialogId: string | null;
  /** The open chat's phase and thread, as the engine holds them. */
  phase: StreamingPhase;
  messages: readonly ChatMessage[];
  /** The open chat's history has loaded; before that its thread says nothing yet. */
  activeThreadLoaded: boolean;
}

/**
 * The status at the end of each chat list row: working, waiting for approval, or none (the lib then shows unread
 * replies).
 *
 * Only the open chat is subscribed to its stream, so it answers from its own phase and thread; every other row from
 * what the server last said of it (`useMingoDialogRowsStore`: `streamState`, `pendingApproval`), which the list's timer
 * refreshes. The open chat's live state is written onto its row, so leaving it mid-answer or with an approval pending
 * keeps the glyph until the server says otherwise.
 */
export function useMingoDialogRowStatus({
  activeDialogId,
  phase,
  messages,
  activeThreadLoaded,
}: UseMingoDialogRowStatusOptions): (dialog: DialogItem) => MingoDialogStatus | undefined {
  const rows = useMingoDialogRowsStore(s => s.rows);
  const live = activeDialogId && activeThreadLoaded ? liveRowState(phase, messages) : null;

  const liveStreaming = live?.streaming;
  const liveAwaiting = live?.awaitingApproval;
  const liveRequestId = live?.approvalRequestId;
  useEffect(() => {
    if (!activeDialogId || liveStreaming === undefined || liveAwaiting === undefined) return;
    noteMingoLiveRow(activeDialogId, {
      streaming: liveStreaming,
      awaitingApproval: liveAwaiting,
      approvalRequestId: liveRequestId,
    });
  }, [activeDialogId, liveStreaming, liveAwaiting, liveRequestId]);

  // What the returned function closes over decides when the list re-renders, so it is the open row's status, a
  // string, never `live`: that object is new with every streamed chunk, and a function keyed on it re-rendered every
  // history row once per chunk.
  const openRowStatus = live ? dialogRowStatus(live) : undefined;
  const openRowIsLive = live !== null;
  return dialog => {
    if (openRowIsLive && dialog.id === activeDialogId) return openRowStatus;
    const row = rows.get(dialog.id);
    return row ? dialogRowStatus(row) : undefined;
  };
}
