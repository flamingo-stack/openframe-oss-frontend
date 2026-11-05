'use client';

import type { ChunkData } from '@flamingo-stack/openframe-frontend-core';
import { useEffect, useRef } from 'react';
import { useAppLiveTail } from '@/lib/nats/use-app-live-tail';
import { NATS_TOPICS } from '../constants';

interface TicketDialogSubscriptionProps {
  dialogId: string | null;
  /** Dispatch a chunk directly to the client-side processor. */
  dispatchChunk: (chunk: ChunkData) => void;
  /** Resume sequence for the CLIENT topic; 0 = replay from stream start (per-dialog filter). */
  clientInitialOptStartSeq: number;
  /** Gates JetStream consumer creation until history has loaded. */
  isInitialOptStartSeqReady: boolean;
  /** The CLIENT tail came back after a gap and delivered what the stream held: the moment to refetch persisted
   *  history. */
  onCaughtUp?: () => void;
}

const noop = () => {};

/**
 * A ticket's client chat, on the lib's JetStream tail (`jetStreamLiveTail`): the tail every chat runs, which drops a
 * redelivered chunk by its stream sequence and reports a resync after a gap.
 */
export function TicketDialogSubscription({
  dialogId,
  dispatchChunk,
  clientInitialOptStartSeq,
  isInitialOptStartSeqReady,
  onCaughtUp,
}: TicketDialogSubscriptionProps) {
  const latest = useRef({ dispatchChunk, onCaughtUp });
  useEffect(() => {
    latest.current = { dispatchChunk, onCaughtUp };
  });

  useAppLiveTail(NATS_TOPICS.MESSAGE, {
    enabled: !!dialogId,
    dialogId,
    // Unknown until the history has loaded: the tail opens once it is.
    fromSeq: isInitialOptStartSeqReady ? clientInitialOptStartSeq : undefined,
    onEvent: payload => latest.current.dispatchChunk(payload as ChunkData),
    onConnect: noop,
    onResync: () => latest.current.onCaughtUp?.(),
  });

  return null;
}
