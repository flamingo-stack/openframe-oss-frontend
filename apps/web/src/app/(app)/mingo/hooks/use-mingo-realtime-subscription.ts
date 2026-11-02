'use client';

import {
  type ChunkData,
  type NatsMessageType,
  useJetStreamDialogSubscription,
} from '@flamingo-stack/openframe-frontend-core';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { registerActiveDialogView } from '@/lib/active-dialog-views';
import type { ChatModelMetadata } from '@/lib/chat-stream-thread';
import { featureFlags } from '@/lib/feature-flags';
import { useNatsAppConfig } from '@/lib/nats/nats-app-config';
import { useChatChunkProcessor } from '@/lib/use-chat-chunk-processor';
import { noteMingoToolExecuted } from '../stores/mingo-created-entities-store';
import { bindMingoDialog, setMingoChatHandlers, useMingoMessagesStore } from '../stores/mingo-messages-store';
import { mingoDialogQueryKeys } from '../utils/query-keys';

export const MINGO_JETSTREAM_TOPIC: NatsMessageType = 'admin-message';
export const CHAT_CHUNKS_STREAM = 'CHAT_CHUNKS';

interface UseMingoRealtimeSubscriptionOptions {
  onChunkReceived?: (dialogId: string, chunk: ChunkData, messageType: NatsMessageType) => void;
}

interface DialogSubscriptionState {
  isSubscribed: boolean;
  isConnected: boolean;
  hasCaughtUp: boolean;
}

interface UseMingoRealtimeSubscription {
  subscribeToDialog: (dialogId: string) => void;
  unsubscribeFromDialog: (dialogId: string) => void;
  getSubscriptionState: (dialogId: string) => DialogSubscriptionState;
  subscribedDialogs: Set<string>;
  connectionState: 'connected' | 'disconnected' | 'connecting';
  onConnectionChange: (dialogId: string, connected: boolean) => void;
}

export function useMingoRealtimeSubscription(
  activeDialogId: string | null,
  options: UseMingoRealtimeSubscriptionOptions = {},
): UseMingoRealtimeSubscription {
  const { onChunkReceived } = options;

  const [subscribedDialogs, setSubscribedDialogs] = useState<Set<string>>(new Set());
  const [dialogStates, setDialogStates] = useState<Map<string, DialogSubscriptionState>>(new Map());
  const [connectionState, setConnectionState] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected');

  const onChunkReceivedRef = useRef(onChunkReceived);
  const catchupRefs = useRef<Map<string, unknown>>(new Map());

  const resetUnread = useMingoMessagesStore(s => s.resetUnread);

  useEffect(() => {
    onChunkReceivedRef.current = onChunkReceived;
  }, [onChunkReceived]);

  const onConnectionChange = useCallback((dialogId: string, connected: boolean) => {
    setConnectionState(connected ? 'connected' : 'disconnected');
    setDialogStates(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(dialogId);
      if (existing) {
        newMap.set(dialogId, { ...existing, isConnected: connected });
      }
      return newMap;
    });
  }, []);

  const getSubscriptionState = useCallback(
    (dialogId: string): DialogSubscriptionState => {
      return (
        dialogStates.get(dialogId) || {
          isSubscribed: false,
          isConnected: false,
          hasCaughtUp: false,
        }
      );
    },
    [dialogStates],
  );

  const subscribeToDialog = useCallback(
    (dialogId: string) => {
      if (subscribedDialogs.has(dialogId)) return;

      setSubscribedDialogs(prev => new Set(prev).add(dialogId));
      setDialogStates(prev => {
        const newMap = new Map(prev);
        newMap.set(dialogId, {
          isSubscribed: true,
          isConnected: false,
          hasCaughtUp: false,
        });
        return newMap;
      });

      if (dialogId === activeDialogId) {
        resetUnread(dialogId);
      }
    },
    [subscribedDialogs, activeDialogId, resetUnread],
  );

  const unsubscribeFromDialog = useCallback((dialogId: string) => {
    setSubscribedDialogs(prev => {
      const newSet = new Set(prev);
      newSet.delete(dialogId);
      return newSet;
    });

    setDialogStates(prev => {
      const newMap = new Map(prev);
      newMap.delete(dialogId);
      return newMap;
    });

    catchupRefs.current.delete(dialogId);
  }, []);

  useEffect(() => {
    if (activeDialogId && !subscribedDialogs.has(activeDialogId)) {
      subscribeToDialog(activeDialogId);
    }
  }, [activeDialogId, subscribedDialogs, subscribeToDialog]);

  return {
    subscribeToDialog,
    unsubscribeFromDialog,
    getSubscriptionState,
    subscribedDialogs,
    connectionState,
    onConnectionChange,
  };
}

interface UseDialogChunkProcessorOptions {
  onApprove?: (requestId?: string) => void | Promise<void>;
  onReject?: (requestId?: string) => void | Promise<void>;
  /** Persisted request-id → status seed the reducer consults on replay. */
  approvalStatuses?: Record<string, string>;
  onMetadata?: (metadata: ChatModelMetadata) => void;
}

/**
 * Phase 4: chunks feed the lib's master stream reducer directly
 * (`decodeNatsChunk` → `dialogStore.apply`). The reducer owns EVERY
 * accumulation rule that used to live in the ~270-LOC callback glue here
 * (stream windows, segment routing, cross-message tool merges, approval
 * flips, participant dedup, typing phase); the store mirrors its snapshot.
 * The residual side concerns (own-echo suppression, approval-status sync,
 * the keyed incomplete-turn seed) are shared with the tickets processor via
 * `useChatChunkProcessor`, and the model badge rides the reducer's own
 * `onMetadata` effect; only the handler binding is mingo-specific.
 */
function useDialogChunkProcessor(dialogId: string, options: UseDialogChunkProcessorOptions = {}) {
  const { onApprove, onReject, approvalStatuses, onMetadata } = options;

  useEffect(() => {
    setMingoChatHandlers(dialogId, { onApprove, onReject, onMetadata });
  }, [dialogId, onApprove, onReject, onMetadata]);

  const messages = useMingoMessagesStore(s => s.messagesByDialog.get(dialogId));

  const processChunk = useChatChunkProcessor({
    boundMirror: bindMingoDialog(dialogId),
    messages,
    approvalStatuses,
  });

  return { processChunk };
}

interface DialogSubscriptionProps {
  dialogId: string;
  isActive: boolean;
  onApprove?: (requestId?: string) => void;
  onReject?: (requestId?: string) => void;
  /** Persisted request-id → status seed the reducer consults on replay. */
  approvalStatuses?: Record<string, string>;
  onConnectionChange?: (dialogId: string, connected: boolean) => void;
  onMetadata?: (metadata: ChatModelMetadata) => void;
  initialOptStartSeq: number | null;
  isInitialOptStartSeqReady: boolean;
  /**
   * Whether the dialog counts as on screen while this tail runs (default true):
   * registered in `active-dialog-views`, so its notifications skip the popup and
   * are auto-read. False when the tail outlives the view — the Mingo-first shell
   * keeps it running on every page, and the chat is on screen only on its page.
   */
  onScreen?: boolean;
}

export function DialogSubscription({
  dialogId,
  onApprove,
  onReject,
  approvalStatuses,
  onConnectionChange,
  onMetadata,
  initialOptStartSeq,
  isInitialOptStartSeqReady,
  onScreen = true,
}: DialogSubscriptionProps) {
  const { getWsUrl, onBeforeReconnect } = useNatsAppConfig();

  // While this live tail is mounted on screen the user is watching the dialog, so
  // the notifications pipeline suppresses popups / auto-reads for it.
  useEffect(() => (onScreen ? registerActiveDialogView(dialogId) : undefined), [dialogId, onScreen]);

  const recordHighestStreamSeq = useMingoMessagesStore(s => s.recordHighestStreamSeq);
  const storedHighestSeq = useMingoMessagesStore(s => s.highestStreamSeqByDialog.get(dialogId) ?? 0);
  // Without a cursor of its own the tail starts where the host says, and `null`
  // (history whose rows say nothing about the stream) means live tail.
  const effectiveOptStartSeq =
    storedHighestSeq > 0 ? Math.max(initialOptStartSeq ?? 0, storedHighestSeq) : initialOptStartSeq;

  const { processChunk: processorProcessChunk } = useDialogChunkProcessor(dialogId, {
    onApprove,
    onReject,
    approvalStatuses,
    onMetadata,
  });

  const processorRef = useRef(processorProcessChunk);
  useEffect(() => {
    processorRef.current = processorProcessChunk;
  }, [processorProcessChunk]);

  const queryClient = useQueryClient();

  // Dispatch-level redelivery gate (mirrors the tickets subscription):
  // JetStream is at-least-once, so a chunk with an equal-or-older streamSeq
  // has already been processed — letting it through duplicates accumulator
  // text / participant rows.
  const lastDispatchedStreamSeqRef = useRef<number>(-1);
  useEffect(() => {
    lastDispatchedStreamSeqRef.current = -1;
  }, [dialogId]);

  // The dialog's stream state is NOT mirrored from chunks: the ai-agent puts
  // none on them. It exists only as `Dialog.streamState` (resolved from the
  // dialog lock), so the detail query is its one source — polled while
  // STREAMING, refetched after a resync (below).
  const handleJetStreamEvent = useCallback(
    (payload: unknown, _messageType: NatsMessageType) => {
      const chunk = payload as ChunkData;
      if (featureFlags.debugNatsChunks.enabled()) {
        console.log('[mingo-js] chunk received', { dialogId, streamSeq: chunk.streamSeq, chunk });
      }
      if (typeof chunk.streamSeq === 'number') {
        if (chunk.streamSeq <= lastDispatchedStreamSeqRef.current) return;
        lastDispatchedStreamSeqRef.current = chunk.streamSeq;
        recordHighestStreamSeq(dialogId, chunk.streamSeq);
      }
      processorRef.current(chunk);
      // A create Mingo just ran adds a row to a list the page behind the chat may show.
      noteMingoToolExecuted(chunk);
    },
    [recordHighestStreamSeq, dialogId],
  );

  const handleConnect = useCallback(() => {
    onConnectionChange?.(dialogId, true);
  }, [dialogId, onConnectionChange]);

  const handleDisconnect = useCallback(() => {
    onConnectionChange?.(dialogId, false);
  }, [dialogId, onConnectionChange]);

  const { caughtUpCount } = useJetStreamDialogSubscription({
    enabled: isInitialOptStartSeqReady,
    dialogId,
    streamName: CHAT_CHUNKS_STREAM,
    topic: MINGO_JETSTREAM_TOPIC,
    optStartSeq: effectiveOptStartSeq,
    onEvent: handleJetStreamEvent,
    onConnect: handleConnect,
    onDisconnect: handleDisconnect,
    onBeforeReconnect,
    getNatsWsUrl: getWsUrl,
  });

  // After a gap, once the replay is in (see `caughtUpCount`): CHAT_CHUNKS keeps
  // only ~10 minutes, so a longer gap is only in persisted history.
  const lastHandledCatchUpRef = useRef(0);
  useEffect(() => {
    if (caughtUpCount <= lastHandledCatchUpRef.current) return;
    lastHandledCatchUpRef.current = caughtUpCount;
    void queryClient.invalidateQueries({ queryKey: mingoDialogQueryKeys.messages(dialogId) });
    void queryClient.invalidateQueries({ queryKey: mingoDialogQueryKeys.detail(dialogId) });
  }, [caughtUpCount, queryClient, dialogId]);

  return null;
}
