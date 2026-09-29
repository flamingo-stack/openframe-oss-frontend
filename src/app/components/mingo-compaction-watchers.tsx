'use client';

import {
  type ChunkData,
  MESSAGE_TYPE,
  maxPersistedStreamSeq,
  useJetStreamDialogSubscription,
} from '@flamingo-stack/openframe-frontend-core';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { useNatsAppConfig } from '@/lib/nats/nats-app-config';
import { CHAT_CHUNKS_STREAM, MINGO_JETSTREAM_TOPIC } from '../(app)/mingo/hooks/use-mingo-realtime-subscription';
import { getMingoDialogMessagesQuery } from '../(app)/mingo/queries/dialogs-queries';
import { useMingoCompactionStore } from '../(app)/mingo/stores/mingo-compaction-store';
import { useMingoMessagesStore } from '../(app)/mingo/stores/mingo-messages-store';
import type { MessagesResponse } from '../(app)/mingo/types/message.types';
import { mingoDialogQueryKeys } from '../(app)/mingo/utils/query-keys';

// Nothing has been sent while the stream is not live, so this bound can be short.
export const COMPACTION_STREAM_START_TIMEOUT_MS = 30_000;
// The compaction's own chunks settle the watch. This only bounds a stream that
// dropped them, so the progress toast cannot outlive the compaction forever.
export const COMPACTION_WATCH_TIMEOUT_MS = 5 * 60_000;

const COMPACTION_FAILED_MESSAGE = 'Failed to compact chat memory';
const COMPACTION_START_FAILED_MESSAGE = "Couldn't start compacting this chat. Try again in a moment.";

type CompactionOutcome = { kind: 'compacted' } | { kind: 'failed'; reason?: string };

type CompactionRequestResult =
  | { kind: 'accepted' }
  | { kind: 'unconfirmed' }
  | { kind: 'nothing-to-compact' }
  | { kind: 'refused'; message: string };

async function requestCompaction(dialogId: string): Promise<CompactionRequestResult> {
  const response = await apiClient.post(`/chat/api/v1/dialogs/${dialogId}/compact`);
  if (response.ok) return { kind: 'accepted' };
  // No answer (timeout, dropped connection): the request may have reached the
  // server, which then compacts regardless.
  if (response.status === 0) return { kind: 'unconfirmed' };
  if (response.status === 422) return { kind: 'nothing-to-compact' };
  if (response.status === 409) {
    return { kind: 'refused', message: 'Mingo is still working on this chat. Try again once it finishes.' };
  }
  return { kind: 'refused', message: response.error || COMPACTION_FAILED_MESSAGE };
}

// Enough of the newest history to hold the highest persisted stream sequence.
const LATEST_MESSAGES_LIMIT = 10;

/**
 * The stream sequence the watcher resumes after. Without one the lib's JetStream
 * client replays everything the stream still holds for the dialog (it ignores
 * the live-tail policy), which would hand the watcher the chunks of an earlier
 * compaction. The open dialog's live tail knows the newest sequence; otherwise
 * the newest persisted message does, and CONTEXT_COMPACTION_START/END are
 * persisted, so none can come before it.
 */
async function latestStreamSeq(dialogId: string): Promise<number> {
  const response = await apiClient.post<MessagesResponse>('/chat/graphql', {
    query: getMingoDialogMessagesQuery(),
    variables: { dialogId, limit: LATEST_MESSAGES_LIMIT, sortField: 'createdAt', sortDirection: 'DESC' },
  });
  if (!response.ok || !response.data?.data?.messages) {
    throw new Error(response.error || 'Failed to fetch messages');
  }
  const persisted = maxPersistedStreamSeq([{ messages: response.data.data.messages.edges.map(edge => edge.node) }]);
  return Math.max(persisted, useMingoMessagesStore.getState().getHighestStreamSeq(dialogId));
}

const stringField = (value: unknown) => (typeof value === 'string' && value ? value : undefined);

/**
 * One manual compaction, from request to result. The backend refuses up front
 * a dialog that is mid-turn (409) or has nothing to compact (422); otherwise it
 * answers 202 and runs the compaction afterwards, reporting it only on the
 * dialog's chunk stream: CONTEXT_COMPACTION_START, then CONTEXT_COMPACTION_END
 * or an ERROR chunk, then MESSAGE_END in every case.
 *
 * The request waits for the stream: the consumer resumes after the dialog's
 * newest known sequence (see `latestStreamSeq`), and the request goes out once
 * it exists, so no chunk of this compaction can be published before it.
 *
 * The stream can still carry the tail of the turn the dialog was busy with when
 * the request went out, and the lock that orders publishing does not order
 * delivery against the HTTP answer — that tail can arrive after the 202. So a
 * chunk counts only after a CONTEXT_COMPACTION_START. START is not unique to
 * this compaction (an ordinary turn publishes one when it auto-compacts), but
 * one landing between the consumer going live and the 409 or 202 would need a
 * summary to finish inside a request's round trip. Anything that never shows a
 * START — a failure before it, a context emptied since the 422 check — falls to
 * the watch timeout instead.
 */
function CompactionWatcher({ dialogId }: { dialogId: string }) {
  const { toast, dismiss } = useToast();
  const queryClient = useQueryClient();
  const { getWsUrl, onBeforeReconnect } = useNatsAppConfig();
  const finishCompaction = useMingoCompactionStore(state => state.finishCompaction);

  // State drives the timer; the ref guards the request, which a second
  // `onSubscribed` before the re-render must not send twice.
  const [requested, setRequested] = useState(false);
  // Undefined until known; the consumer is not created before it is.
  const [startSeq, setStartSeq] = useState<number | undefined>(undefined);
  const requestedRef = useRef(false);
  const mountedRef = useRef(false);
  const settledRef = useRef(false);
  const startedRef = useRef(false);
  const outcomeRef = useRef<CompactionOutcome | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const settle = useCallback(
    (show: () => void) => {
      if (settledRef.current || !mountedRef.current) return;
      settledRef.current = true;
      show();
      finishCompaction(dialogId);
    },
    [dialogId, finishCompaction],
  );

  const settleError = useCallback(
    (description: string) => settle(() => toast({ title: 'Error', description, variant: 'destructive' })),
    [settle, toast],
  );

  const settleNothingToCompact = useCallback(
    () =>
      settle(() =>
        toast({ title: 'Nothing to compact yet', description: 'This chat is still short enough to keep in full.' }),
      ),
    [settle, toast],
  );

  const settleTurnEnd = useCallback(() => {
    const outcome = outcomeRef.current;
    if (outcome?.kind === 'failed') {
      settleError(outcome.reason || COMPACTION_FAILED_MESSAGE);
    } else if (outcome?.kind === 'compacted') {
      settle(() => {
        // A dialog compacted from the list without being open has no live tail
        // writing the compaction into its cached history.
        void queryClient.invalidateQueries({ queryKey: mingoDialogQueryKeys.messages(dialogId) });
        toast({ title: 'Chat memory compacted', variant: 'success' });
      });
    } else {
      settleError(COMPACTION_FAILED_MESSAGE);
    }
  }, [dialogId, queryClient, settle, settleError, toast]);

  // Created a tick late: the Toaster adds a toast on a deferred tick, so a
  // dismiss issued in the same tick as the create (StrictMode's throwaway mount)
  // finds nothing and the never-expiring toast would stay forever.
  useEffect(() => {
    let progressToastId: number | string | undefined;
    const createTimer = setTimeout(() => {
      progressToastId = toast({ title: 'Compacting chat memory…', duration: Infinity });
    });
    return () => {
      clearTimeout(createTimer);
      if (progressToastId !== undefined) dismiss(progressToastId);
    };
  }, [dismiss, toast]);

  useEffect(() => {
    const timer = requested
      ? setTimeout(
          () =>
            settleError(
              "Couldn't confirm the compaction finished. It may still complete — check the chat in a moment.",
            ),
          COMPACTION_WATCH_TIMEOUT_MS,
        )
      : setTimeout(() => settleError(COMPACTION_START_FAILED_MESSAGE), COMPACTION_STREAM_START_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [requested, settleError]);

  useEffect(() => {
    let cancelled = false;
    latestStreamSeq(dialogId)
      .then(seq => {
        if (!cancelled) setStartSeq(seq);
      })
      .catch(() => {
        if (!cancelled) settleError(COMPACTION_START_FAILED_MESSAGE);
      });
    return () => {
      cancelled = true;
    };
  }, [dialogId, settleError]);

  const handleSubscribed = useCallback(() => {
    if (requestedRef.current) return;
    requestedRef.current = true;
    setRequested(true);
    requestCompaction(dialogId)
      .then(result => {
        if (result.kind === 'nothing-to-compact') settleNothingToCompact();
        else if (result.kind === 'refused') settleError(result.message);
      })
      .catch(() => settleError(COMPACTION_FAILED_MESSAGE));
  }, [dialogId, settleError, settleNothingToCompact]);

  const handleEvent = useCallback(
    (payload: unknown) => {
      const chunk = payload as ChunkData;
      if (chunk.type === MESSAGE_TYPE.CONTEXT_COMPACTION_START) {
        startedRef.current = true;
        return;
      }
      if (!startedRef.current) return;
      if (chunk.type === MESSAGE_TYPE.CONTEXT_COMPACTION_END) {
        outcomeRef.current = { kind: 'compacted' };
      } else if (chunk.type === MESSAGE_TYPE.ERROR) {
        outcomeRef.current = { kind: 'failed', reason: stringField(chunk.details) ?? stringField(chunk.error) };
      } else if (chunk.type === MESSAGE_TYPE.MESSAGE_END) {
        settleTurnEnd();
      }
    },
    [settleTurnEnd],
  );

  useJetStreamDialogSubscription({
    enabled: startSeq !== undefined,
    dialogId,
    streamName: CHAT_CHUNKS_STREAM,
    topic: MINGO_JETSTREAM_TOPIC,
    optStartSeq: startSeq ?? null,
    onEvent: handleEvent,
    onSubscribed: handleSubscribed,
    onBeforeReconnect,
    getNatsWsUrl: getWsUrl,
  });

  return null;
}

/**
 * Hosts a watcher per compacting dialog. Mounted beside the Mingo drawer rather
 * than inside it, so a compaction started from the drawer still reports its
 * result after the drawer closes.
 */
export function MingoCompactionWatchers() {
  const compactingDialogIds = useMingoCompactionStore(state => state.compactingDialogIds);
  const resetCompactions = useMingoCompactionStore(state => state.resetCompactions);

  // With no host left, an id could only be picked up again by a later host,
  // which would send its request a second time.
  useEffect(() => resetCompactions, [resetCompactions]);

  return compactingDialogIds.map(dialogId => <CompactionWatcher key={dialogId} dialogId={dialogId} />);
}
