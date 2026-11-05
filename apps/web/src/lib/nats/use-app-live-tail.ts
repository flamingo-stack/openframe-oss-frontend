'use client';

import type { NatsMessageType } from '@flamingo-stack/openframe-frontend-core';
import { type ChatLiveTailOptions, jetStreamLiveTail } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { useMemo } from 'react';
import { useNatsAppConfig } from './nats-app-config';

/**
 * A dialog's JetStream tail on this app's NATS connection: the lib's `jetStreamLiveTail`, the tail every chat runs.
 * It opens once `fromSeq` is known, starts right after it, drops a redelivered chunk by its stream sequence, and calls
 * `onResync` when it came back after a gap. For the subscriptions outside a chat engine (a remote session's chat, a
 * compaction being watched); Mingo and a ticket's client chat hand the same tail to their engines.
 */
export function useAppLiveTail(topic: NatsMessageType, options: ChatLiveTailOptions): void {
  const { getWsUrl, onBeforeReconnect } = useNatsAppConfig();
  const useLiveTail = useMemo(
    () => jetStreamLiveTail({ getNatsWsUrl: getWsUrl, topic, onBeforeReconnect }),
    [getWsUrl, topic, onBeforeReconnect],
  );
  useLiveTail(options);
}
