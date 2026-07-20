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
import type { ChatStreamReducer } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { useCallback, useEffect, useRef } from 'react';
import { type BoundMirror, computeIncompleteTailState } from '@/lib/chat-stream-thread';

export type { ChatModelMetadata } from '@/lib/chat-stream-thread';

export interface UseChatChunkProcessorOptions {
  /** Pre-curried handle for the bound dialog/side (`mirror.bind(key)`). Named
   *  `boundMirror`, not `mirror`: the hosts' module-level `ReducerMirror` (the
   *  whole multi-key registry) is also called `mirror`, and the two altitudes
   *  must not read alike here. */
  boundMirror: BoundMirror;
  /** Hydrated thread of the bound dialog/side (drives the seeding guard). */
  messages: readonly ChatMessage[] | undefined;
  /**
   * Identity of the thread currently bound. The incomplete-turn seed is a
   * ONE-SHOT PER KEY: neither host remounts this hook on dialog/side switch
   * (tickets clears chat state on `ticketId` change rather than unmounting),
   * so an unkeyed boolean guard would latch after the first thread and every
   * later thread with a pending approval or an executing tool would replay
   * its continuation chunks into a fresh bubble — duplicated approval card,
   * duplicated tool rows, and a hydrated pending approval that never
   * resolves. Key on dialogId (mingo) / `${ticketId}:${side}` (tickets).
   */
  seedKey: string;
  /** Approval statuses the reducer consults when an APPROVAL_REQUEST replays. */
  approvalStatuses?: Record<string, string>;
  /** Host hook, run before the shared `apply`. Return `true` to claim the
   *  event (the shared path then skips `apply`). */
  interceptEvent?: (event: ChatStreamEvent) => boolean;
}

export function useChatChunkProcessor({
  boundMirror,
  messages,
  seedKey,
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

  // Status lookup the reducer consults when an APPROVAL_REQUEST replays.
  // `boundMirror` comes from `ReducerMirror.bind(key)`, which memoizes per key —
  // so this effect re-runs on a real key change, not on every host render.
  useEffect(() => {
    if (approvalStatuses && Object.keys(approvalStatuses).length > 0) {
      boundMirror.mergeApprovalStatuses(approvalStatuses);
    }
  }, [approvalStatuses, boundMirror]);

  // One-shot-PER-KEY incomplete-turn seed: once the hydrated thread shows an
  // unfinished trailing assistant run (pending approvals / executing tools),
  // seed the reducer's per-turn kernel so continuation chunks merge instead
  // of replaying into a fresh bubble. See `seedKey` above for why the guard
  // is keyed rather than a plain boolean.
  const seededKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (seededKeyRef.current === seedKey || !messages || messages.length === 0) return;
    const extras = computeIncompleteTailState(messages);
    if (!extras) return;
    seededKeyRef.current = seedKey;
    boundMirror.mutate((r: ChatStreamReducer) => r.initializeWithState(null, extras));
  }, [seedKey, messages, boundMirror]);

  return useCallback((chunk: unknown) => {
    const event = decodeNatsChunk(chunk);
    if (!event) return;

    if (interceptEventRef.current?.(event)) return;

    boundMirrorRef.current.apply(event);
  }, []);
}
