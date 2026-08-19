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
 *     `event.userId === currentUserId` drop this hook used to do ALSO
 *     swallowed the same user's messages sent from a second tab or device,
 *     which the reducer's text-matched consumption does not.
 *   - the model-badge metadata mapping is the reducer's `onMetadata` EFFECT,
 *     wired once in `natsMirrorOptions` instead of being re-derived from the
 *     raw event by each host.
 *
 * Host-specific behaviour arrives via `interceptEvent` (tickets uses it for
 * client-authored DIRECT_MESSAGE rows, which the lib reducer would otherwise
 * render as admin-authored).
 */

import type { Message as ChatMessage } from '@flamingo-stack/openframe-frontend-core';
import { type ChatStreamEvent, decodeNatsChunk } from '@flamingo-stack/openframe-frontend-core/chat-protocol';
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
   *  event (the shared path then skips `apply`). */
  interceptEvent?: (event: ChatStreamEvent) => boolean;
}

export function useChatChunkProcessor({
  boundMirror,
  messages,
  approvalStatuses,
  interceptEvent,
}: UseChatChunkProcessorOptions): (chunk: unknown) => void {
  // LATEST-REF IDIOM (assigned in the render body, deliberately): the returned
  // `processChunk` must have a STABLE identity — both hosts stash it in a ref
  // and hand it to a long-lived JetStream subscription, so a new identity per
  // render would churn the subscription. Writing the refs during render (vs.
  // in an effect) means the very first chunk after a prop change already sees
  // the new value; these are write-only mirrors of props, never read during
  // render, so they cannot desync the rendered output.
  const boundMirrorRef = useRef(boundMirror);
  boundMirrorRef.current = boundMirror;
  const interceptEventRef = useRef(interceptEvent);
  interceptEventRef.current = interceptEvent;

  // EVICTION EPOCH. Both effects below write state into a specific reducer
  // INSTANCE, and LRU eviction silently replaces that instance behind an
  // UNCHANGED key — `bind(key)` is memoized per key, so nothing else about
  // these effects' inputs moves, and the replacement would be left without the
  // persisted statuses and without the accumulator seed. The mirror bumps this
  // counter per evicted key (and rebuilds the bound handle), which is the
  // dependency that re-arms both.
  const { evictionEpoch } = boundMirror;

  // Status lookup the reducer consults when an APPROVAL_REQUEST replays.
  // `boundMirror` comes from `ReducerMirror.bind(key)`, which memoizes per key —
  // so this effect re-runs on a real key change (or an eviction), not on every
  // host render.
  // biome-ignore lint/correctness/useExhaustiveDependencies: evictionEpoch is the re-arm trigger, not used in the body — the replacement reducer needs this merge replayed.
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
  // thread, statuses, seq cursor and armed echoes, but NOT the per-turn kernel
  // (accumulator), so an unfinished turn would resume into a fresh bubble.
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
    const event = decodeNatsChunk(chunk);
    // The decode seam is the only place both halves are visible at once. The
    // raw-chunk log upstream shows what the backend sent; this one shows what
    // it BECAME — and, crucially, what it did not: a chunk the decoder returns
    // `null` for (an unknown type, or a guide frame kind that deliberately does
    // not cross over into the NATS kernel) is invisible everywhere else.
    if (featureFlags.debugNatsChunks.enabled()) {
      const type = (chunk as { type?: unknown } | null)?.type;
      console.log(`[chat-chunk] ${String(type)} → ${event?.type ?? 'DROPPED'}`, { chunk, event });
    }
    if (!event) return;

    if (interceptEventRef.current?.(event)) return;

    boundMirrorRef.current.apply(event);

    // Approval events only, and only under the debug flag: read the reducer
    // back so the log says whether the event became a SEGMENT. Without this the
    // trail dead-ends at "decoded fine, nothing on screen" and the two very
    // different causes — the reducer refusing the card (its `approvalType` is
    // not in `displayApprovalTypes`) and the card being created but later
    // dropped by the history merge — look identical from outside.
    if (event.type === 'approval-request' && featureFlags.debugNatsChunks.enabled()) {
      boundMirrorRef.current.mutate(reducer => {
        const messages = reducer.state.messages as Array<{ segments?: Array<{ type: string }> }>;
        const last = messages[messages.length - 1];
        console.log(`[chat-chunk] after apply → segments: ${JSON.stringify((last?.segments ?? []).map(s => s.type))}`);
      });
    }
  }, []);
}
