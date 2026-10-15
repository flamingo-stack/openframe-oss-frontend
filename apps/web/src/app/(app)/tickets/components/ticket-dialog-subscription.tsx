'use client';

import { type ChunkData, useJetStreamDialogSubscription } from '@flamingo-stack/openframe-frontend-core';
import { useCallback, useEffect, useRef } from 'react';
import { useNatsAppConfig } from '@/lib/nats/nats-app-config';
import { NATS_TOPICS } from '../constants';

const CHAT_CHUNKS_STREAM = 'CHAT_CHUNKS';

interface TicketDialogSubscriptionProps {
  dialogId: string | null;
  /** Dispatch a chunk directly to the client-side processor. */
  dispatchChunk: (chunk: ChunkData) => void;
  /** Resume sequence for the CLIENT topic; 0 = replay from stream start (per-dialog filter). */
  clientInitialOptStartSeq: number;
  /** Gates JetStream consumer creation until history has loaded. */
  isInitialOptStartSeqReady: boolean;
  /** Fired when the CLIENT tail's `caughtUpCount` moves: the moment to refetch
   *  persisted history after a gap (see `caughtUpCount`). */
  onCaughtUp?: () => void;
}

export function TicketDialogSubscription({
  dialogId,
  dispatchChunk,
  clientInitialOptStartSeq,
  isInitialOptStartSeqReady,
  onCaughtUp,
}: TicketDialogSubscriptionProps) {
  const { getWsUrl, onBeforeReconnect } = useNatsAppConfig();

  const dispatchRef = useRef(dispatchChunk);
  useEffect(() => {
    dispatchRef.current = dispatchChunk;
  }, [dispatchChunk]);

  // JetStream redeliveries may repeat a streamSeq during reconnect; drop any
  // we've already applied.
  const lastClientStreamSeqRef = useRef<number>(-1);

  // dialogId change is the reset trigger
  useEffect(() => {
    lastClientStreamSeqRef.current = -1;
  }, [dialogId]);

  const handleClientJsEvent = useCallback((payload: unknown) => {
    const chunk = payload as ChunkData;
    if (typeof chunk.streamSeq === 'number') {
      if (chunk.streamSeq <= lastClientStreamSeqRef.current) return;
      lastClientStreamSeqRef.current = chunk.streamSeq;
    }
    dispatchRef.current(chunk);
  }, []);

  const { caughtUpCount } = useJetStreamDialogSubscription({
    enabled: !!dialogId && isInitialOptStartSeqReady,
    dialogId,
    streamName: CHAT_CHUNKS_STREAM,
    topic: NATS_TOPICS.MESSAGE,
    optStartSeq: clientInitialOptStartSeq,
    onEvent: handleClientJsEvent,
    onBeforeReconnect,
    getNatsWsUrl: getWsUrl,
  });

  const onCaughtUpRef = useRef(onCaughtUp);
  useEffect(() => {
    onCaughtUpRef.current = onCaughtUp;
  }, [onCaughtUp]);

  // The ref keeps a repeated read from re-notifying the parent.
  const lastNotifiedCatchUpRef = useRef(0);
  useEffect(() => {
    if (caughtUpCount <= lastNotifiedCatchUpRef.current) return;
    lastNotifiedCatchUpRef.current = caughtUpCount;
    onCaughtUpRef.current?.();
  }, [caughtUpCount]);

  return null;
}
