'use client';

import {
  type ChunkData,
  type NatsMessageType,
  useJetStreamDialogSubscription,
} from '@flamingo-stack/openframe-frontend-core';
import { decodeNatsChunk } from '@flamingo-stack/openframe-frontend-core/chat-protocol';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { registerActiveDialogView } from '@/lib/active-dialog-views';
import { computeIncompleteTailState } from '@/lib/chat-stream-thread';
import { featureFlags } from '@/lib/feature-flags';
import { useNatsAppConfig } from '@/lib/nats/nats-app-config';
import { useAuthStore } from '@/stores';
import {
  applyMingoChatEvent,
  mutateMingoDialog,
  setMingoApprovalHandlers,
  syncMingoApprovalStatuses,
  useMingoMessagesStore,
} from '../stores/mingo-messages-store';
import type { DialogNode } from '../types/dialog.types';

const MINGO_JETSTREAM_TOPIC: NatsMessageType = 'admin-message';
const CHAT_CHUNKS_STREAM = 'CHAT_CHUNKS';

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
  const catchupRefs = useRef<Map<string, any>>(new Map());

  const { resetUnread } = useMingoMessagesStore();

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
  approvalStatuses?: Record<string, any>;
  onMetadata?: (metadata: {
    modelDisplayName: string;
    modelName: string;
    providerName: string;
    contextWindow: number;
  }) => void;
}

/**
 * Phase 4: chunks feed the lib's master stream reducer directly
 * (`decodeNatsChunk` → `dialogStore.apply`). The reducer owns EVERY
 * accumulation rule that used to live in the ~270-LOC callback glue here
 * (stream windows, segment routing, cross-message tool merges, approval
 * flips, participant dedup, typing phase); the store mirrors its snapshot.
 * Only true side concerns remain: own-echo suppression (the optimistic
 * send already rendered the user's bubble), the metadata side-channel for
 * the model badge, approval handler binding, and the one-shot
 * incomplete-turn seed after history hydration.
 */
function useDialogChunkProcessor(dialogId: string, options: UseDialogChunkProcessorOptions = {}) {
  const { onApprove, onReject, approvalStatuses, onMetadata } = options;

  const currentUserId = useAuthStore(state => state.user?.id);
  const currentUserIdRef = useRef(currentUserId);
  currentUserIdRef.current = currentUserId;
  const onMetadataRef = useRef(onMetadata);
  onMetadataRef.current = onMetadata;

  useEffect(() => {
    if (onApprove || onReject) {
      setMingoApprovalHandlers(dialogId, { onApprove, onReject });
    }
  }, [dialogId, onApprove, onReject]);

  // Status lookup the reducer consults when an APPROVAL_REQUEST replays.
  useEffect(() => {
    if (approvalStatuses && Object.keys(approvalStatuses).length > 0) {
      syncMingoApprovalStatuses(dialogId, approvalStatuses);
    }
  }, [dialogId, approvalStatuses]);

  // One-shot incomplete-turn seed: once the hydrated thread shows an
  // unfinished trailing assistant run (pending approvals / executing
  // tools), seed the reducer's per-turn kernel so continuation chunks
  // merge instead of replaying into a fresh bubble.
  const messages = useMingoMessagesStore(s => s.messagesByDialog.get(dialogId));
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current || !messages || messages.length === 0) return;
    const extras = computeIncompleteTailState(messages);
    if (!extras) return;
    seededRef.current = true;
    mutateMingoDialog(dialogId, r => r.initializeWithState(null, extras));
  }, [dialogId, messages]);

  const processChunk = useCallback(
    (chunk: unknown) => {
      const event = decodeNatsChunk(chunk);
      if (!event) return;

      // Side-channel: model badge refinement (kept outside the reducer).
      if (event.type === 'metadata') {
        onMetadataRef.current?.({
          modelDisplayName: event.modelLabel ?? event.modelName ?? '',
          modelName: event.modelName ?? '',
          providerName: event.provider ?? '',
          contextWindow: event.contextWindowMaxTokens ?? 0,
        });
      }

      // Own MESSAGE_REQUEST echo — the optimistic send already rendered it
      // (with the admin's name/avatar, which the wire echo doesn't carry).
      if (
        event.type === 'participant' &&
        event.kind === 'message-request' &&
        event.userId &&
        event.userId === currentUserIdRef.current
      ) {
        return;
      }

      applyMingoChatEvent(dialogId, event);
    },
    [dialogId],
  );

  return { processChunk };
}

interface DialogSubscriptionProps {
  dialogId: string;
  isActive: boolean;
  onApprove?: (requestId?: string) => void;
  onReject?: (requestId?: string) => void;
  approvalStatuses?: Record<string, any>;
  onConnectionChange?: (dialogId: string, connected: boolean) => void;
  onMetadata?: (metadata: {
    modelDisplayName: string;
    modelName: string;
    providerName: string;
    contextWindow: number;
  }) => void;
  initialOptStartSeq: number | null;
  isInitialOptStartSeqReady: boolean;
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
}: DialogSubscriptionProps) {
  const { getWsUrl, onBeforeReconnect } = useNatsAppConfig();

  // While this live tail is mounted the user is watching the dialog, so the
  // notifications pipeline suppresses popups / auto-reads for it.
  useEffect(() => registerActiveDialogView(dialogId), [dialogId]);

  const recordHighestStreamSeq = useMingoMessagesStore(s => s.recordHighestStreamSeq);
  const storedHighestSeq = useMingoMessagesStore(s => s.highestStreamSeqByDialog.get(dialogId) ?? 0);
  const effectiveOptStartSeq = Math.max(initialOptStartSeq ?? 0, storedHighestSeq);

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

  // Rejects out-of-order JetStream redeliveries.
  const lastAppliedStreamSeqRef = useRef<number>(-1);

  // Dispatch-level redelivery gate (mirrors the tickets subscription):
  // JetStream is at-least-once, so a chunk with an equal-or-older streamSeq
  // has already been processed — letting it through duplicates accumulator
  // text / participant rows. The streamState guard above only protects the
  // query-cache write, not the processor.
  const lastDispatchedStreamSeqRef = useRef<number>(-1);
  useEffect(() => {
    lastDispatchedStreamSeqRef.current = -1;
  }, [dialogId]);

  const syncStreamStateFromChunk = useCallback(
    (chunk: ChunkData) => {
      if (typeof chunk.streamSeq === 'number') {
        recordHighestStreamSeq(dialogId, chunk.streamSeq);
      }
      const next = chunk.streamState;
      if (!next) return;
      if (typeof chunk.streamSeq === 'number') {
        if (chunk.streamSeq < lastAppliedStreamSeqRef.current) return;
        lastAppliedStreamSeqRef.current = chunk.streamSeq;
      }
      queryClient.setQueryData<DialogNode | null | undefined>(['mingo-dialog', dialogId], prev =>
        prev ? { ...prev, streamState: next } : prev,
      );
    },
    [queryClient, dialogId, recordHighestStreamSeq],
  );

  const handleJetStreamEvent = useCallback(
    (payload: unknown, _messageType: NatsMessageType) => {
      const chunk = payload as ChunkData;
      if (featureFlags.debugNatsChunks.enabled()) {
        console.log('[mingo-js] chunk received', { dialogId, streamSeq: chunk.streamSeq, chunk });
      }
      if (typeof chunk.streamSeq === 'number') {
        if (chunk.streamSeq <= lastDispatchedStreamSeqRef.current) return;
        lastDispatchedStreamSeqRef.current = chunk.streamSeq;
      }
      syncStreamStateFromChunk(chunk);
      processorRef.current(chunk);
    },
    [syncStreamStateFromChunk, dialogId],
  );

  const handleConnect = useCallback(() => {
    onConnectionChange?.(dialogId, true);
  }, [dialogId, onConnectionChange]);

  const handleDisconnect = useCallback(() => {
    onConnectionChange?.(dialogId, false);
  }, [dialogId, onConnectionChange]);

  const { reconnectionCount } = useJetStreamDialogSubscription({
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

  // NATS reconnect: JetStream replays only ~10 minutes of CHAT_CHUNKS, so an
  // outage longer than that leaves a gap the resume-by-seq cannot fill.
  // Refetch persisted history — the merge layer dedupes what replay covers.
  const lastHandledReconnectRef = useRef(0);
  useEffect(() => {
    if (reconnectionCount <= lastHandledReconnectRef.current) return;
    lastHandledReconnectRef.current = reconnectionCount;
    void queryClient.invalidateQueries({ queryKey: ['mingo-dialog-messages', dialogId] });
    void queryClient.invalidateQueries({ queryKey: ['mingo-dialog', dialogId] });
  }, [reconnectionCount, queryClient, dialogId]);

  return null;
}
