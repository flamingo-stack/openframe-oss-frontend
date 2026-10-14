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
  /** Fired once the tail is back after a gap (a NATS reconnect, a consumer
   *  recreation, a resync after the page was hidden) AND has replayed what the
   *  stream still held. The CHAT_CHUNKS stream retains ~10 minutes, so a longer
   *  gap is only in persisted history — the parent refetches it here, after the
   *  replay: a refetch landing first merges without the replayed messages,
   *  which then show twice. */
  onReconnected?: () => void;
}

export function TicketDialogSubscription({
  dialogId,
  dispatchChunk,
  clientInitialOptStartSeq,
  isInitialOptStartSeqReady,
  onReconnected,
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

  const onReconnectedRef = useRef(onReconnected);
  useEffect(() => {
    onReconnectedRef.current = onReconnected;
  }, [onReconnected]);

  // The ref keeps a repeated read from re-notifying the parent.
  const lastNotifiedCatchUpRef = useRef(0);
  useEffect(() => {
    if (caughtUpCount <= lastNotifiedCatchUpRef.current) return;
    lastNotifiedCatchUpRef.current = caughtUpCount;
    onReconnectedRef.current?.();
  }, [caughtUpCount]);

  return null;
}
