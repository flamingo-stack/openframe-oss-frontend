'use client';

/**
 * useChatChunkProcessor — the NATS chunk→reducer glue shared by both chat
 * hosts (the mingo dialog subscription and the tickets per-side processor).
 *
 * Phase 4 pushed message ACCUMULATION into the lib's master stream reducer,
 * which left both hosts with the same residual side concerns — and two
 * verbatim copies of them. They live here now:
 *
 *   1. a ref-mirror for the host intercept, so the returned `processChunk`
 *      identity does not churn per render;
 *   2. the approval-status sync effect (the lookup the reducer consults when
 *      an APPROVAL_REQUEST replays);
 *   3. the KEYED one-shot incomplete-turn seed after history hydration.
 *
 * Two concerns that USED to live here have moved down to their real owner:
 *   - own-echo suppression is the reducer's (`pushOptimisticSend` records the
 *     sent text; the MESSAGE_REQUEST handler consumes exactly one match, with
 *     a content-dedup window for seq-less rows). The blanket
 *     `userId === currentUserId` drop this hook used to do ALSO
 *     swallowed the same user's messages sent from a second tab or device,
 *     which the reducer's text-matched consumption does not.
 *   - the model-badge metadata mapping is the reducer's `onMetadata` EFFECT,
 *     wired once in `natsMirrorOptions` instead of being re-derived from the
 *     raw chunk by each host.
 *
 * Host-specific behaviour arrives via `interceptEntry` (tickets uses it for
 * client-authored DIRECT_MESSAGE rows, which the lib reducer would otherwise
 * render as admin-authored).
 */

import type { ChatMessage, ChatStreamEntry } from '@flamingo-stack/openframe-frontend-core/chat-protocol';
import { useCallback, useEffect, useRef } from 'react';
import type { BoundMirror } from '@/lib/chat-stream-thread';
import { featureFlags } from '@/lib/feature-flags';

export type { ChatModelMetadata } from '@/lib/chat-stream-thread';

export interface UseChatChunkProcessorOptions {
  /** Pre-curried handle for the bound dialog/side (`mirror.bind(key)`). Named
   *  `boundMirror`, not `mirror`: the hosts' module-level `ReducerMirror` (the
   *  whole multi-key registry) is also called `mirror`, and the two altitudes
   *  must not read alike here. */
  boundMirror: BoundMirror;
  /** Hydrated thread of the bound dialog/side — the source this hook re-seeds
   *  a REPLACEMENT reducer from after an LRU eviction. */
  messages: readonly ChatMessage[] | undefined;
  /** Approval statuses the reducer consults when an APPROVAL_REQUEST replays. */
  approvalStatuses?: Record<string, string>;
  /** Host hook, run before the shared `apply`. Return `true` to claim the
   *  entry (the shared path then skips `apply`). */
  interceptEntry?: (entry: ChatStreamEntry) => boolean;
}

export function useChatChunkProcessor({
  boundMirror,
  messages,
  approvalStatuses,
  interceptEntry,
}: UseChatChunkProcessorOptions): (chunk: unknown) => void {
  // LATEST-REF IDIOM (assigned in the render body, deliberately): the returned
  // `processChunk` must have a STABLE identity — both hosts stash it in a ref
  // and hand it to a long-lived JetStream subscription, so a new identity per
  // render would churn the subscription. Writing the refs during render (vs.
  // in an effect) means the very first chunk after a prop change already sees
  // the new value; these are write-only mirrors of props, never read during
  // render, so they cannot desync the rendered output.
  const boundMirrorRef = useRef(boundMirror);
  const interceptEntryRef = useRef(interceptEntry);
  // Latest-value refs, written after the commit rather than during render:
  // a render-phase ref write is what `react-hooks/refs` forbids, and every
  // reader below runs in an effect, a timer or an event handler.
  useEffect(() => {
    boundMirrorRef.current = boundMirror;
    interceptEntryRef.current = interceptEntry;
  });

  // EVICTION EPOCH. Both effects below write state into a specific reducer
  // INSTANCE, and LRU eviction silently replaces that instance behind an
  // UNCHANGED key — `bind(key)` is memoized per key, so nothing else about
  // these effects' inputs moves, and the replacement would be left without the
  // persisted statuses and without the incomplete-turn extras. The mirror bumps this
  // counter per evicted key (and rebuilds the bound handle), which is the
  // dependency that re-arms both.
  const { evictionEpoch } = boundMirror;

  // Status lookup the reducer consults when an APPROVAL_REQUEST replays.
  // `boundMirror` comes from `ReducerMirror.bind(key)`, which memoizes per key —
  // so this effect re-runs on a real key change (or an eviction), not on every
  // host render.
  // evictionEpoch is the re-arm trigger, not used in the body — the replacement reducer needs this merge replayed.
  useEffect(() => {
    if (approvalStatuses && Object.keys(approvalStatuses).length > 0) {
      boundMirror.mergeApprovalStatuses(approvalStatuses);
    }
  }, [approvalStatuses, boundMirror, evictionEpoch]);

  // POST-EVICTION RE-SEED — the only seeding this hook still owns.
  //
  // Ordinary hydration (history fetch, dialog switch, page refetch) goes
  // through `mirror.hydrate`, which owns the whole three-step protocol; a
  // second seeding rule here would be the same split that let the adopt-once
  // flag go unarmed for an entire release.
  //
  // Eviction is the case `hydrate` cannot cover: the store silently replaces a
  // reducer behind an UNCHANGED key, and the host has no reason to re-fetch —
  // so nothing would call `hydrate` again. The mirror's parking restores the
  // thread, statuses, seq cursor and armed echoes, but NOT the agent-busy phase
  // of an unfinished turn.
  //
  // `expectingReplay: false`: the replacement gets no catchup replay, and an
  // adopt-once flag armed here would survive until the next genuine turn and
  // make it overwrite a completed bubble.
  const seededEpochRef = useRef(evictionEpoch);
  useEffect(() => {
    if (seededEpochRef.current === evictionEpoch) return;
    seededEpochRef.current = evictionEpoch;
    if (!messages || messages.length === 0) return;
    boundMirror.hydrate(messages, { expectingReplay: false });
  }, [messages, boundMirror, evictionEpoch]);

  return useCallback((chunk: unknown) => {
    const entry = boundMirrorRef.current.decode(chunk);
    const applied = entry.chunks.length > 0;
    // The decode seam is the only place both halves are visible at once. The
    // raw-chunk log upstream shows what the backend sent; this one shows what
    // it BECAME — and, crucially, what it did not: a chunk the decoder answers
    // with nothing (an unknown type, a redelivery) is invisible everywhere else.
    if (featureFlags.debugNatsChunks.enabled()) {
      const type = (chunk as { type?: unknown } | null)?.type;
      const became = applied ? entry.chunks.map(c => c.type).join(', ') : 'DROPPED';
      console.log(`[chat-chunk] ${String(type)} → ${became}`, { chunk, entry });
    }
    if (!applied) return;

    if (interceptEntryRef.current?.(entry)) return;

    boundMirrorRef.current.apply(entry);

    // Approval chunks only, and only under the debug flag: read the reducer
    // back so the log says whether the chunk became a PART. Without this the
    // trail dead-ends at "decoded fine, nothing on screen" when the card was
    // created but later dropped by the history merge.
    if (
      featureFlags.debugNatsChunks.enabled() &&
      entry.chunks.some(decoded => decoded.type === 'tool-approval-request')
    ) {
      boundMirrorRef.current.mutate(reducer => {
        const last = reducer.state.messages.at(-1);
        console.log(`[chat-chunk] after apply → parts: ${JSON.stringify((last?.parts ?? []).map(p => p.type))}`);
      });
    }
  }, []);
}
