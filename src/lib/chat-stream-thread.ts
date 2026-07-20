/**
 * Shared shape bridge between the app's legacy chat `Message` (content:
 * string | MessageSegment[]) and the lib master reducer's
 * `UnifiedChatMessage` (content: string, segments?: MessageSegment[]).
 *
 * Phase 4 of the chat unification: the lib's `createChatDialogStore`
 * reducers own ALL message accumulation; the app stores keep only a
 * converted read-mirror. Conversion is cached BIDIRECTIONALLY by object
 * identity so the reducer's referential-stability contract survives the
 * round-trip — an untouched reducer message always converts back to the
 * SAME app message instance, which is what keeps the per-message React
 * memoization (and the history merge's reference reuse) intact.
 */

import {
  type Message as ChatMessage,
  extractIncompleteTailState,
  type MessageSegment,
} from '@flamingo-stack/openframe-frontend-core';
import type { ChatStreamEvent } from '@flamingo-stack/openframe-frontend-core/chat-protocol';
import {
  type AssistantType,
  type ChatApprovalStatus,
  type ChatDialogSide,
  type ChatDialogStore,
  type ChatReducerEffect,
  type ChatReducerState,
  type ChatStreamReducer,
  type ChatStreamReducerOptions,
  createDeltaBatcher,
  type DeltaBatcher,
  type DeltaEvent,
  type InitializeExtras,
  type ProcessedMessage,
  type StreamingPhase,
  type UnifiedChatMessage,
} from '@flamingo-stack/openframe-frontend-core/components/chat';

export interface ThreadIdentityDefaults {
  assistantName?: string;
  assistantType?: AssistantType;
}

const toUnifiedCache = new WeakMap<object, UnifiedChatMessage>();
const toAppCache = new WeakMap<object, ChatMessage>();

/** App `Message` → reducer `UnifiedChatMessage` (segments field). */
export function toUnifiedMessage(message: ChatMessage): UnifiedChatMessage {
  const cached = toUnifiedCache.get(message);
  if (cached) return cached;

  const { content, ...rest } = message;
  // Double cast is load-bearing, NOT laziness: the two shapes are genuinely
  // incompatible on `role` — app `Message.role` admits `'error'`, which
  // `UnifiedChatMessage.role` ('user' | 'assistant') does not. `rest` also
  // carries the app-only `assistantType`, which the round-trip must preserve
  // (see `fromUnifiedMessage`) even though the reducer never reads it.
  const unified = (Array.isArray(content)
    ? { ...rest, content: '', segments: content }
    : { ...rest, content: content ?? '' }) as unknown as UnifiedChatMessage;

  toUnifiedCache.set(message, unified);
  // Round-trip stability: reading this row back yields the ORIGINAL object.
  toAppCache.set(unified, message);
  return unified;
}

/** Reducer `UnifiedChatMessage` → app `Message` (content array). Rows the
 *  reducer created itself (turn bubbles, participant rows) get the side's
 *  assistant identity + a stable timestamp stamped at first conversion.
 *  Module-private: the mirror is the only legitimate conversion point (it
 *  owns the per-key output-array reuse the reference-stability contract
 *  depends on), so hosts must not call this directly. */
function fromUnifiedMessage(unified: UnifiedChatMessage, defaults: ThreadIdentityDefaults): ChatMessage {
  const cached = toAppCache.get(unified);
  if (cached) return cached;

  const { segments, content, ...rest } = unified as UnifiedChatMessage & {
    segments?: MessageSegment[];
  };
  const source = rest as Partial<ChatMessage>;
  const message = {
    ...rest,
    content: (segments ?? content ?? '') as ChatMessage['content'],
    timestamp: source.timestamp ?? new Date(),
    ...(unified.role === 'assistant'
      ? {
          name: unified.name ?? defaults.assistantName,
          assistantType: source.assistantType ?? defaults.assistantType,
        }
      : {}),
  } as ChatMessage;

  toAppCache.set(unified, message);
  toUnifiedCache.set(message, unified);
  return message;
}

/**
 * Incomplete-turn tail of a hydrated thread → the reducer's
 * `initializeWithState` extras (accumulator seed: pending approvals +
 * executing tools + trailing segments).
 *
 * The run-collecting walk lives in the lib (`extractIncompleteTailState`),
 * shared with the NATS adapter, so there is ONE incompleteness rule set.
 * This wrapper only adapts the app's `ChatMessage` rows to the lib's
 * `ProcessedMessage` shape.
 */
export function computeIncompleteTailState(messages: readonly ChatMessage[]): InitializeExtras | undefined {
  return extractIncompleteTailState(messages as unknown as readonly ProcessedMessage[]);
}

// ─── Optimistic-row helpers ─────────────────────────────────────────────────

/**
 * Id for a locally-authored chat row. Collision-resistant without a uuid dep
 * (time prefix orders, random suffix disambiguates within the same ms) and,
 * more importantly, ONE recipe: three call sites had grown their own copies
 * with drifting prefixes, and the reducer's echo consumption keys off rows
 * looking the way this send path makes them.
 */
export function makeChatRowId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Display name for an operator-authored row. This app's operator IS the
 *  admin, hence the fallback. */
export function adminDisplayName(user?: { firstName?: string; lastName?: string } | null): string {
  return [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Admin';
}

// ─── Reducer → store mirror factory ─────────────────────────────────────────

/** One converted read-mirror snapshot of a reducer side. */
export interface ReducerMirrorSnapshot {
  /** App-shape thread. Reference-stable while the reducer thread is untouched. */
  messages: ChatMessage[];
  phase: StreamingPhase;
  /** Id of the assistant bubble an open stream writes into (merge exemption). */
  streamingId: string | null;
  /** Raw reducer snapshot, for host-specific fields (token usage, approvals). */
  state: ChatReducerState;
}

export interface ReducerMirrorConfig<K extends string> {
  store: ChatDialogStore;
  /** Map a host mirror key to its (dialogId, side) + assistant identity. */
  identityFor: (key: K) => {
    dialogId: string;
    side: ChatDialogSide;
    defaults: ThreadIdentityDefaults;
  };
  /** Consulted ONLY when a (dialogId, side) reducer is first created. */
  options: (key: K) => ChatStreamReducerOptions;
  /** Host patch applied on every CHANGED snapshot (zustand setState, …). */
  onSnapshot: (key: K, snapshot: ReducerMirrorSnapshot) => void;
  /**
   * Keys whose reducers participate in the dialog store's CROSS-KEY
   * projections (approval resolution by requestId, tool-execution merge by
   * execId) — i.e. keys a non-delta event landing on `key` can also mutate.
   * Tickets returns both sides; mingo omits this (dialogs are independent).
   *
   * The mirror materializes them before the event lands (a projection needs
   * a target reducer even when that key has never streamed) and re-syncs
   * them after. Deltas are exempt: cross-key projections only fire on
   * non-delta frames, so batched text costs nothing extra.
   */
  siblingKeys?: (key: K) => readonly K[];
}

/** Pre-curried per-key handle — see `ReducerMirror.bind`. */
export interface BoundMirror {
  apply: (event: ChatStreamEvent) => void;
  mutate: (fn: (reducer: ChatStreamReducer) => void) => void;
  /** MERGE (stream-learned wins) — see `ReducerMirror.mergeApprovalStatuses`. */
  mergeApprovalStatuses: (statuses: Record<string, string>) => void;
}

export interface ReducerMirror<K extends string> {
  /** Create-or-get the reducer behind `key` (registers it as known). */
  getReducer: (key: K) => ChatStreamReducer;
  /** Re-project `key`'s reducer snapshot into the host store (no-op when unchanged). */
  sync: (key: K) => void;
  /** Apply one decoded stream event, then sync. Deltas are batched (see below). */
  apply: (key: K, event: ChatStreamEvent) => void;
  /** Run reducer commands (non-wire mutations), then sync. Force-flushes deltas. */
  mutate: <T>(key: K, fn: (reducer: ChatStreamReducer) => T) => T;
  /** Read-modify-write on the app-shape thread, delegated to the reducer. */
  mutateThread: (key: K, op: (messages: ChatMessage[]) => ChatMessage[]) => void;
  /**
   * Merge a host-held PERSISTED approval-status map into `key`'s reducer.
   * Delegates to the reducer's `mergeApprovalStatuses`, which bakes in
   * stream-learned precedence — both hosts previously spread the host map
   * LAST, which lets a stale persisted 'pending' downgrade an approval the
   * stream had just resolved (and re-arm its buttons).
   */
  mergeApprovalStatuses: (key: K, statuses: Record<string, string>) => void;
  /**
   * Land a host-authored optimistic user bubble THROUGH the reducer, so the
   * reducer records the pending echo text and consumes the backend's
   * MESSAGE_REQUEST echo itself (one-shot, text-matched) instead of the host
   * blanket-dropping every echo bearing its own user id.
   */
  pushOptimisticSend: (key: K, message: ChatMessage) => void;
  /** Pre-curried, per-key-stable `{ apply, mutate, mergeApprovalStatuses }`.
   *  Memoized inside the mirror so React hosts need no `useCallback`. */
  bind: (key: K) => BoundMirror;
  /**
   * Declare the key(s) currently DISPLAYED. Exactly those are pinned against
   * the dialog store's LRU eviction; any previously-active key not in `keys`
   * is released back to LRU protection-by-recency. Idempotent — call it on
   * every selection change.
   *
   * Retention tracks what is on screen, NOT what the mirror has ever seen:
   * pinning every touched key makes memory grow with dialogs-visited and
   * defeats the cap the LRU exists to enforce.
   */
  setActiveKeys: (keys: readonly K[]) => void;
  /** Drop the reducer + conversion caches for `key`. Force-flushes first. */
  drop: (key: K) => void;
  /** Every key this mirror has seen and not dropped. */
  knownKeys: () => K[];
}

/**
 * createReducerMirror — the reducer-mirror scaffold both chat hosts (mingo
 * dialogs, ticket sides) share. Only the key type and the host's zustand
 * patch differ, so everything else lives here: reducer create-or-get,
 * snapshot-identity change detection, the app-shape conversion cache, the
 * streamingId derivation, thread read-modify-write and cache teardown.
 *
 * REFERENCE STABILITY is the contract that matters. Two guards preserve it,
 * and both must stay: (1) an unchanged reducer snapshot short-circuits
 * before any conversion, and (2) an unchanged `snap.messages` array reuses
 * the previously converted output array verbatim. Break either and every
 * inline approval/tool card remounts on each chunk.
 *
 * RETENTION FOLLOWS WHAT IS DISPLAYED. The dialog store evicts
 * least-recently-used reducers past its cap (10) unless a key is RETAINED;
 * the React `useChatStreamReducer` hook retains for its lifetime, but this
 * factory is the only NON-React host and serves BOTH mingo (one key per
 * dialog) and tickets. The OPEN thread must be pinned — evict it and the next
 * `sync` recreates an EMPTY reducer whose changed snapshot patches the host
 * store with `messages: []`, blanking a visible thread. But pinning every key
 * the mirror has ever SEEN makes memory track dialogs-visited and defeats the
 * cap outright, so hosts declare the displayed key(s) via `setActiveKeys`
 * (mingo: its `activeDialogId`; tickets: both sides of the open ticket) and
 * everything else falls back to LRU protection-by-recency plus the store's
 * own `streamingPhase !== 'idle'` guard, which already refuses to evict a
 * live stream.
 *
 * EVICTION OF A NON-DISPLAYED KEY IS THEN SAFE because `getReducer` detects
 * RECREATION by reducer identity: a key whose reducer object changed had its
 * predecessor evicted, so the mirror suppresses the pristine-empty snapshot
 * instead of projecting it into the host store. The host's own hydration
 * (which re-runs on selection — mingo resets its processed-history guard on
 * `activeDialogId` change and re-`setMessages` the merged thread) then fills
 * the fresh reducer, and that non-empty snapshot syncs normally. Emptiness
 * alone is NOT the discriminator: a genuine `setMessages([])` must still
 * reach the host.
 *
 * DELTA BATCHING is NOT reimplemented here: the lib's framework-free
 * `createDeltaBatcher` is the single implementation, shared with the React
 * wrapper (`useChatStreamReducer`). It coalesces consecutive same-type
 * deltas and lands them ~once per animation frame (always-armed ≤50ms timer
 * fallback, because rAF pauses in background tabs) — Anthropic emits 30-60
 * deltas/sec, and applying each synchronously re-renders the whole thread
 * that many times. `push` returns FALSE for a non-delta event: the caller
 * then flushes and applies it itself, so ordering is preserved and turn
 * completion / dialog switch / unmount can never strand buffered text.
 */
export function createReducerMirror<K extends string>(config: ReducerMirrorConfig<K>): ReducerMirror<K> {
  const { store, identityFor, options, onSnapshot, siblingKeys } = config;

  const knownKeys = new Set<K>();
  const lastSyncedSnapshot = new Map<K, ChatReducerState>();
  const lastConvertedThread = new Map<K, { source: readonly UnifiedChatMessage[]; out: ChatMessage[] }>();
  const boundByKey = new Map<K, BoundMirror>();
  /** key → the store's release fn for a DISPLAYED key. Driven by
   *  `setActiveKeys` (and released in `drop`) — see the RETENTION note. */
  const releaseByKey = new Map<K, () => void>();
  /** key → the reducer instance last handed out, so a recreated (i.e.
   *  previously evicted) reducer is detectable by identity. */
  const reducerByKey = new Map<K, ChatStreamReducer>();
  /** Keys whose reducer was recreated and has not been re-seeded yet. Their
   *  pristine-empty snapshot must not blank the host's cached thread. */
  const recreatedKeys = new Set<K>();

  // The batcher applies against the key it FLUSHED, which on a key change is
  // the PREVIOUS key — never assume it is the key currently being handled.
  // `applyOne` records it; `onFlushed` (which fires for explicit flushes AND
  // for the rAF/timer-scheduled ones) re-projects exactly that key.
  let flushedKey: K | null = null;

  const batcher: DeltaBatcher<K> = createDeltaBatcher<K>({
    applyOne: (delta: DeltaEvent, key: K | undefined) => {
      if (key === undefined) return;
      flushedKey = key;
      const { dialogId, side } = identityFor(key);
      store.apply(dialogId, side, delta);
    },
    onFlushed: () => {
      if (flushedKey === null) return;
      const key = flushedKey;
      flushedKey = null;
      sync(key);
    },
  });

  /** Land any pending batch (and re-project it) — see `onFlushed` above. */
  function flushDeltas(): void {
    batcher.flush();
  }

  function getReducer(key: K): ChatStreamReducer {
    knownKeys.add(key);
    const { dialogId, side } = identityFor(key);
    const reducer = store.getReducer(dialogId, side, () => options(key));
    const previous = reducerByKey.get(key);
    if (previous !== undefined && previous !== reducer) {
      // A DIFFERENT instance for a key we already held means the old one was
      // LRU-evicted. Everything derived from it is stale, and its pristine
      // state must not be projected — see the RETENTION note.
      recreatedKeys.add(key);
      lastSyncedSnapshot.delete(key);
      lastConvertedThread.delete(key);
    }
    reducerByKey.set(key, reducer);
    return reducer;
  }

  function setActiveKeys(keys: readonly K[]): void {
    const next = new Set<K>(keys);
    // Retain the newcomers BEFORE releasing anyone: a key present in both the
    // old and new set must never dip to zero retains in between.
    for (const key of next) {
      if (releaseByKey.has(key)) continue;
      const { dialogId, side } = identityFor(key);
      releaseByKey.set(key, store.retain(dialogId, side));
    }
    for (const [key, release] of [...releaseByKey]) {
      if (next.has(key)) continue;
      release();
      releaseByKey.delete(key);
    }
  }

  function sync(key: K): void {
    getReducer(key);
    const { dialogId, side, defaults } = identityFor(key);
    const snap = store.getSnapshot(dialogId, side);
    if (lastSyncedSnapshot.get(key) === snap) return;
    if (recreatedKeys.has(key)) {
      // Post-eviction reducer that nothing has re-seeded yet: projecting its
      // empty thread would blank the host's cached one. Wait for the host's
      // hydration to land (it re-runs on selection); the resulting non-empty
      // snapshot clears the flag and syncs normally.
      if (snap.messages.length === 0) return;
      recreatedKeys.delete(key);
    }
    lastSyncedSnapshot.set(key, snap);

    const prevConverted = lastConvertedThread.get(key);
    const messages =
      prevConverted && prevConverted.source === snap.messages
        ? prevConverted.out
        : snap.messages.map(u => fromUnifiedMessage(u, defaults));
    lastConvertedThread.set(key, { source: snap.messages, out: messages });

    const phase = snap.streamingPhase;
    const last = messages[messages.length - 1];
    const streamingId = phase === 'streaming' && last?.role === 'assistant' ? last.id : null;

    onSnapshot(key, { messages, phase, streamingId, state: snap });
  }

  function apply(key: K, event: ChatStreamEvent): void {
    // ORDER IS LOAD-BEARING: a pending batch must land BEFORE
    // `getReducer(key)`. The dialog store evicts least-recently-used
    // reducers, so resolving a NEW key's reducer first can evict the pending
    // key's — and the flush would then replay buffered text into a freshly
    // recreated, empty one. `batcher.push` performs the key-change flush
    // internally, which is exactly why it is called before `getReducer`.
    const queued = batcher.push(event, key);
    getReducer(key);
    if (queued) return;
    // `push` returned false: not a delta. Per the batcher contract the caller
    // flushes and applies it itself, so completion / approval / error frames
    // always land on fully-applied delta state.
    batcher.flush();
    // Non-delta frames are the only ones the store projects across keys, so
    // this is where (and the only place) siblings must exist and re-sync.
    // Materializing them AFTER the flush keeps the documented
    // flush-before-getReducer ordering intact for every key involved.
    const siblings = siblingKeys?.(key) ?? [];
    for (const sibling of siblings) {
      if (sibling !== key) getReducer(sibling);
    }
    const { dialogId, side } = identityFor(key);
    store.apply(dialogId, side, event);
    sync(key);
    // No-ops when a sibling's snapshot is unchanged (identity short-circuit).
    for (const sibling of siblings) {
      if (sibling !== key) sync(sibling);
    }
  }

  function mutate<T>(key: K, fn: (reducer: ChatStreamReducer) => T): T {
    // Flush FIRST, for the same eviction reason as `apply` — see the note there.
    flushDeltas();
    getReducer(key);
    const { dialogId, side } = identityFor(key);
    const result = store.mutate(dialogId, side, fn);
    sync(key);
    return result;
  }

  function mutateThread(key: K, op: (messages: ChatMessage[]) => ChatMessage[]): void {
    const { defaults } = identityFor(key);
    mutate(key, reducer => {
      const current = reducer.state.messages.map(u => fromUnifiedMessage(u, defaults));
      const next = op(current);
      if (next === current) return;
      reducer.setMessages(next.map(m => toUnifiedMessage(m)));
    });
  }

  /**
   * Delegated to the reducer's `mergeApprovalStatuses`, which fixes the
   * precedence at `{ ...persisted, ...streamLearned }` so no host can get it
   * backwards. Same name as the reducer method, same semantics — the two
   * used to differ, which is what made the old warnings necessary.
   */
  function mergeApprovalStatuses(key: K, statuses: Record<string, string>): void {
    mutate(key, reducer => {
      reducer.mergeApprovalStatuses(statuses as Record<string, ChatApprovalStatus>);
    });
  }

  /**
   * The reducer owns own-echo suppression (`pushOptimisticSend` records the
   * text; the MESSAGE_REQUEST handler consumes exactly ONE match). We route
   * the host's optimistic send through it purely for that bookkeeping, then
   * swap the reducer's two generic placeholder rows for the host's single
   * rich bubble — the host bubble carries name / avatar / contextItems the
   * reducer's bare row does not, and the hosts drive their own typing
   * indicator, so the trailing assistant placeholder (and the phase flip
   * `pushOptimisticSend` performs) must not leak into the mirror.
   */
  function pushOptimisticSend(key: K, message: ChatMessage): void {
    const text = typeof message.content === 'string' ? message.content : '';
    mutate(key, reducer => {
      const phaseBefore = reducer.state.streamingPhase;
      reducer.pushOptimisticSend(text);
      // `pushOptimisticSend` appended exactly [user bubble, assistant placeholder].
      const withoutPlaceholders = reducer.state.messages.slice(0, -2);
      reducer.setMessages([...withoutPlaceholders, toUnifiedMessage(message)]);
      reducer.setPhase(phaseBefore);
    });
  }

  function bind(key: K): BoundMirror {
    const existing = boundByKey.get(key);
    if (existing) return existing;
    const bound: BoundMirror = {
      apply: event => apply(key, event),
      mutate: fn => {
        mutate(key, fn);
      },
      mergeApprovalStatuses: statuses => mergeApprovalStatuses(key, statuses),
    };
    boundByKey.set(key, bound);
    return bound;
  }

  function drop(key: K): void {
    boundByKey.delete(key);
    // Land + cancel everything first: a batch belonging to ANOTHER key would
    // otherwise be stranded, and one belonging to THIS key must not fire on a
    // timer after `store.remove` has taken its reducer away.
    flushDeltas();
    const { dialogId, side } = identityFor(key);
    // Release BEFORE `remove`: a retained key is protected from eviction, and
    // leaving the retain behind would pin a reducer the mirror no longer knows.
    releaseByKey.get(key)?.();
    releaseByKey.delete(key);
    store.remove(dialogId, side);
    lastSyncedSnapshot.delete(key);
    lastConvertedThread.delete(key);
    // A dropped key is intentionally gone — the next `getReducer` builds a
    // fresh reducer that the host is expected to seed, so this is NOT the
    // eviction case the recreation guard exists for.
    reducerByKey.delete(key);
    recreatedKeys.delete(key);
    knownKeys.delete(key);
  }

  return {
    getReducer,
    setActiveKeys,
    sync,
    apply,
    mutate,
    mutateThread,
    mergeApprovalStatuses,
    pushOptimisticSend,
    bind,
    drop,
    knownKeys: () => [...knownKeys],
  };
}

// ─── Shared reducer options ─────────────────────────────────────────────────

/** Late-bound, per-key host handlers (approve/reject + the model badge). */
export interface NatsMirrorHandlers {
  onApprove?: (requestId?: string) => void | Promise<void>;
  onReject?: (requestId?: string) => void | Promise<void>;
  onMetadata?: (metadata: ChatModelMetadata) => void;
}

/** Model-badge side-channel payload (kept outside the reducer state). */
export interface ChatModelMetadata {
  modelDisplayName: string;
  modelName: string;
  providerName: string;
  contextWindow: number;
}

interface ReducerMetadataEffectArgs {
  modelDisplayName?: string;
  modelName?: string;
  providerName?: string;
  contextWindow?: number;
}

/**
 * The `ChatStreamReducerOptions` block both NATS hosts had verbatim.
 * `handlersFor` is consulted at CALL time (not creation time), so hosts can
 * keep late-binding their handlers into a per-key Map.
 *
 * `onMetadata` rides the reducer's own `onMetadata` EFFECT rather than being
 * re-derived from the raw event by each host — the reducer already maps the
 * metadata frame to exactly this shape; only the app's non-optional string /
 * number fallbacks are applied here.
 */
export function natsMirrorOptions<K extends string>(
  handlersFor: (key: K) => NatsMirrorHandlers | undefined,
  // Thunk, not a value: reducer options are read lazily at reducer-creation
  // time, so the flag must be sampled then rather than frozen at wiring time.
  batchApprovalsEnabled: () => boolean,
  // Thunk for the same reason: the signed-in user is not known at module
  // load. See the `selfUserId` note in the returned options.
  selfUserId: () => string | undefined = () => undefined,
): (key: K) => ChatStreamReducerOptions {
  return key => ({
    transport: 'nats',
    displayApprovalTypes: ['CLIENT', 'ADMIN'],
    batchApprovalsEnabled: batchApprovalsEnabled(),
    // This app's operator IS the admin: every optimistic send here is
    // admin-authored, so its MESSAGE_REQUEST echo comes back with
    // ownerType 'ADMIN'. Without this the reducer skips echo consumption
    // for ADMIN rows (correct on hosts where an ADMIN row is a
    // technician's reply) and every message we send renders twice.
    ownEchoIncludesAdmin: true,
    // Pairs with `ownEchoIncludesAdmin` above, which matches on RAW TEXT: the
    // author check is what keeps a stale pending echo from consuming a SECOND
    // technician's identical message on the ticket ADMIN side (that message
    // would then never render). The lib also ages entries out after
    // `OWN_ECHO_TTL_MS`, so a dropped echo cannot poison the thread forever.
    selfUserId: selfUserId(),
    callbacks: {
      onApprove: (id?: string) => handlersFor(key)?.onApprove?.(id),
      onReject: (id?: string) => handlersFor(key)?.onReject?.(id),
    },
    onEffect: (effect: ChatReducerEffect) => {
      if (effect.name !== 'onMetadata') return;
      const args = (effect.args[0] ?? {}) as ReducerMetadataEffectArgs;
      handlersFor(key)?.onMetadata?.({
        modelDisplayName: args.modelDisplayName ?? args.modelName ?? '',
        modelName: args.modelName ?? '',
        providerName: args.providerName ?? '',
        contextWindow: args.contextWindow ?? 0,
      });
    },
  });
}
