'use client';

import {
  type AssistantType,
  computeHistoryPrepend,
  flattenMessagePagesChronological,
  type HistoricalMessage,
  maxPersistedStreamSeq,
  mergeHistoryWithRealtime,
  processHistoricalMessages,
} from '@flamingo-stack/openframe-frontend-core';
import { useEffect, useRef } from 'react';
import type { ChatType } from '../constants';
import type { MessagePage } from '../services/ticket-service.types';
import { type ChatSide, useTicketDetailsStore } from '../stores/ticket-details-store';

interface UseHistoricalMessageSyncOptions {
  side: ChatSide;
  messageDialogId: string | null;
  chatType: ChatType;
  assistantConfig: { name: string; type: AssistantType };
  pages: MessagePage[] | undefined;
  /** react-query `dataUpdatedAt` of the pages — the freshness boundary the
   *  merge uses to decide which realtime synthetics history can replace. */
  dataUpdatedAt: number;
  isFetched: boolean;
}

/**
 * Runs `processHistoricalMessages` against each newly-fetched page of
 * ticket messages and feeds the result into the ticket-details-store.
 */
export function useHistoricalMessages({
  side,
  messageDialogId,
  chatType,
  assistantConfig,
  pages,
  dataUpdatedAt,
  isFetched,
}: UseHistoricalMessageSyncOptions) {
  const getMessages = useTicketDetailsStore(s => s.getMessages);
  const setMessages = useTicketDetailsStore(s => s.setMessages);
  // Reactive (not the getter): the merge must RE-RUN when the stream ends —
  // that's the moment the exempted streaming synthetic becomes droppable
  // against already-fetched history, and nothing else re-triggers the effect.
  const streamingMessageId = useTicketDetailsStore(s => s[side].streamingId);
  const prependWithBoundaryMerge = useTicketDetailsStore(s => s.prependWithBoundaryMerge);
  const approvalStatuses = useTicketDetailsStore(s => s.approvalStatuses);
  const upsertApprovalStatuses = useTicketDetailsStore(s => s.upsertApprovalStatuses);
  const getHighestStreamSeq = useTicketDetailsStore(s => s.getHighestStreamSeq);

  const approvalStatusesRef = useRef(approvalStatuses);
  // Latest-value refs, written after the commit rather than during render:
  // a render-phase ref write is what `react-hooks/refs` forbids, and every
  // reader below runs in an effect, a timer or an event handler.
  useEffect(() => {
    approvalStatusesRef.current = approvalStatuses;
  });

  const processedPageCountRef = useRef(0);
  const prevDialogIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!pages || !messageDialogId || !isFetched) return;

    if (prevDialogIdRef.current !== messageDialogId) {
      processedPageCountRef.current = 0;
      prevDialogIdRef.current = messageDialogId;
    }

    const flatMessages = flattenMessagePagesChronological(pages);

    // The server filters by chatType; `chatTypeFilter` below is the defensive layer.
    const historical: HistoricalMessage[] = flatMessages.map(msg => ({
      id: msg.id,
      dialogId: msg.dialogId,
      chatType: msg.chatType,
      createdAt: msg.createdAt,
      owner: msg.owner,
      messageData: msg.messageData,
      // Feed the merge's per-role seq coverage so a post-reload live synthetic
      // isn't dropped by an unrelated row's seq (message-loss on stop/reload).
      lastChunkStreamSeq: msg.lastChunkStreamSeq,
    }));

    const historicalResolutions: Record<string, 'approved' | 'rejected'> = {};
    for (const msg of historical) {
      const dataArray = Array.isArray(msg.messageData) ? msg.messageData : msg.messageData ? [msg.messageData] : [];
      for (const data of dataArray) {
        const d = data as { type?: string; approvalRequestId?: string; approved?: boolean };
        if (d?.type === 'APPROVAL_RESULT' && typeof d.approvalRequestId === 'string' && d.approvalRequestId) {
          historicalResolutions[d.approvalRequestId] = d.approved ? 'approved' : 'rejected';
        }
      }
    }
    if (Object.keys(historicalResolutions).length > 0) {
      upsertApprovalStatuses(historicalResolutions);
    }

    const { messages: storeMessages } = processHistoricalMessages(historical, {
      assistantName: assistantConfig.name,
      assistantType: assistantConfig.type,
      chatTypeFilter: chatType,
      approvalStatuses: { ...approvalStatusesRef.current, ...historicalResolutions },
    });

    // Empty snapshot (the merge itself also guards this): skip the no-op store write.
    if (storeMessages.length === 0) {
      processedPageCountRef.current = pages.length;
      return;
    }

    const isPagination = processedPageCountRef.current > 0 && pages.length > processedPageCountRef.current;

    if (!isPagination) {
      const merged = mergeHistoryWithRealtime({
        processedHistory: storeMessages,
        rawHistoryIds: new Set(flatMessages.map(m => m.id)),
        existingMessages: getMessages(side),
        streamingMessageId,
        historyFetchedAt: dataUpdatedAt,
        historyMaxStreamSeq: maxPersistedStreamSeq(pages),
        realtimeSeenStreamSeq: getHighestStreamSeq(side),
      });
      setMessages(side, merged);
    } else {
      const prepend = computeHistoryPrepend(storeMessages, getMessages(side));
      if (prepend) {
        prependWithBoundaryMerge(side, prepend.newMessages, prepend.boundaryMessageId, prepend.boundaryUpdates);
      }
    }

    processedPageCountRef.current = pages.length;
  }, [
    side,
    messageDialogId,
    chatType,
    assistantConfig.name,
    assistantConfig.type,
    pages,
    dataUpdatedAt,
    isFetched,
    streamingMessageId,
    getMessages,
    setMessages,
    prependWithBoundaryMerge,
    upsertApprovalStatuses,
    getHighestStreamSeq,
  ]);
}
