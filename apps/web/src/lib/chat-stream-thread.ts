/**
 * The reducer mirror both chat hosts (mingo dialogs, ticket sides) share: the lib's `createChatDialogStore` reducers own
 * ALL message accumulation, and the app stores keep a read-mirror of their snapshots. A thread is `ChatMessage[]` on both
 * sides, the reducer's own objects by reference, which is what keeps the per-message React memoization (and the history
 * merge's reference reuse) intact.
 */

import {
  type ChatMessage,
  type ChatStreamEntry,
  createMingoDecoder,
  type MingoDecoder,
  textOfParts,
} from '@flamingo-stack/openframe-frontend-core/chat-protocol';
import {
  type ChatApprovalStatus,
  type ChatDialogSide,
  type ChatDialogStore,
  type ChatReducerEffect,
  type ChatReducerState,
  type ChatStreamReducer,
  type ChatStreamReducerOptions,
  type CreateChatDialogStoreOptions,
  createDeltaBatcher,
  type DeltaBatcher,
  type DeltaEntry,
  type EvictedReducerState,
  extractIncompleteTailState,
  type StreamingPhase,
} from '@flamingo-stack/openframe-frontend-core/components/chat';

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

/** One read-mirror snapshot of a reducer side. */
export interface ReducerMirrorSnapshot {
  /** The thread. Reference-stable while the reducer thread is untouched. */
  messages: ChatMessage[];
  phase: StreamingPhase;
  /** Id of the assistant bubble an open stream writes into (merge exemption). */
  streamingId: string | null;
  /** Raw reducer snapshot, for host-specific fields (token usage, approvals). */
  state: ChatReducerState;
}

export interface ReducerMirrorConfig<K extends string> {
  /**
   * Build the dialog store. A FACTORY, not a ready-made store, because the
   * mirror must inject its own `onEvict` at creation (the store takes it as a
   * creation option) — handing the mirror a finished store would leave every
   * host free to forget the wiring, and the mirror would be back to inferring
   * eviction. Hosts merge their own options (`defaultCreateOptions`, …) into
   * the ones passed in and return the instance; read it back off
   * `ReducerMirror.store` if the host needs to export it.
   */
  createStore: (storeOptions: CreateChatDialogStoreOptions) => ChatDialogStore;
  /**
   * Map a host mirror key to its (dialogId, side).
   *
   * INVARIANT: a key must ALWAYS map to the SAME `(dialogId, side)` for the
   * mirror's lifetime. Everything keyed by `K` here — the retain handles in
   * `setActiveKeys`, the snapshot cache, the reseed parking — is
   * looked up by key and resolved through this function lazily. The reseed
   * path is the sharpest case: `keyForIdentity` translates the store's
   * eviction signal back to `K` by re-running this function, and the thread
   * `onEvict` parks in `reseedByKey` is
   * replayed into whatever `(dialogId, side)` the key resolves to LATER — so
   * a key whose identity changed would park one thread and re-seed a
   * different reducer with it, or never match at all and silently lose the
   * re-seed. Encode any varying part in the key itself (mingo keys by
   * dialogId; tickets keys by side over a constant thread key).
   */
  identityFor: (key: K) => {
    dialogId: string;
    side: ChatDialogSide;
  };
  /** Consulted ONLY when a (dialogId, side) reducer is first created. */
  options: (key: K) => ChatStreamReducerOptions;
  /** Host patch applied on every CHANGED snapshot (zustand setState, …). */
  onSnapshot: (key: K, snapshot: ReducerMirrorSnapshot) => void;
  /**
   * Keys whose reducers participate in the dialog store's CROSS-KEY
   * projections (approval resolution by its id, a tool's run by its call id)
   * — i.e. keys a non-delta entry landing on `key` can also mutate.
   * Tickets returns both sides; mingo omits this (dialogs are independent).
   *
   * The mirror materializes them before the entry lands (a projection needs
   * a target reducer even when that key has never streamed) and re-syncs
   * them after. Deltas are exempt: cross-key projections only fire on
   * non-delta entries, so batched text costs nothing extra.
   */
  siblingKeys?: (key: K) => readonly K[];
}

/**
 * Options for `hydrate` — the single entry point for a thread fetched from
 * history.
 *
 * `hydrate` is deliberately ONE call because restoring a turn takes three
 * steps that only work together:
 *
 *  1. `initializeWithState(thread)`: the thread itself.
 *  2. the extras of an unfinished trailing assistant run: the agent-busy phase.
 *  3. the adopt-once flag, so a REPLAYED `start` re-streams into the
 *     partial bubble rather than opening a duplicate beside it.
 *
 * While the reducer has a turn open (`streaming`), only step 1 runs and
 * adopt-once is disarmed — see `hydrate`.
 */
export interface HydrateOptions {
  /**
   * Whether a catchup replay is expected to follow (default `true`).
   *
   * The adopt-once flag is only safe while a replay is actually inbound: left
   * armed, it would make the NEXT genuine turn adopt — and overwrite — a
   * completed bubble. The lib's own adapter gates it on an active catchup
   * buffer; this app's subscriptions have no such signal (chunks go straight
   * to the processor), so the flag is instead DISARMED on the first applied
   * entry that is not a `start`. That bounds its life to the very next
   * entry, which after a reload is the replay. Pass `false` on any hydration
   * that is not a fresh subscribe (pagination, an idle refetch) to skip
   * arming it altogether.
   */
  expectingReplay?: boolean;
}

/** Pre-curried per-key handle — see `ReducerMirror.bind`. */
export interface BoundMirror {
  /**
   * One raw chunk of this key's stream, through the key's ONE stateful decoder. It lives exactly as long as the key's
   * reducer sequence does: `drop` retires both, an LRU eviction parks the sequence and keeps it.
   */
  decode: (raw: unknown) => ChatStreamEntry;
  apply: (entry: ChatStreamEntry) => void;
  /** Pre-curried `ReducerMirror.hydrate` for this key. */
  hydrate: (messages: readonly ChatMessage[], options?: HydrateOptions) => void;
  mutate: (fn: (reducer: ChatStreamReducer) => void) => void;
  /** MERGE (stream-learned wins) — see `ReducerMirror.mergeApprovalStatuses`. */
  mergeApprovalStatuses: (statuses: Record<string, string>) => void;
  /**
   * How many times THIS key's reducer has been LRU-evicted and replaced.
   * Snapshotted when the handle was built, and the handle is invalidated on
   * every eviction — so a changed epoch (or, equivalently, a changed handle
   * identity) is the signal a React consumer needs to RE-RUN the one-shot
   * work it did against the previous instance: the persisted approval-status
   * merge and the incomplete-turn extras both target a specific
   * reducer instance, and the replacement starts without either.
   */
  evictionEpoch: number;
}

export interface ReducerMirror<K extends string> {
  /** The dialog store this mirror built via `ReducerMirrorConfig.createStore`
   *  (with the mirror's `onEvict` wired in). Exposed so a host can export the
   *  instance it would otherwise have had to construct itself. */
  store: ChatDialogStore;
  /**
   * THE history-hydration door — the ONLY way a fetched thread should enter a
   * reducer. See `HydrateOptions` for what it does beyond writing messages and
   * why splitting those steps across call sites is what broke before.
   */
  hydrate: (key: K, messages: readonly ChatMessage[], options?: HydrateOptions) => void;
  /**
   * Flip an approval's status on `key`'s thread — the user's decision on the
   * request the tail is waiting on. ALSO cancels an adopt-once that `hydrate`
   * armed: the backend answers the decision by STARTING a turn, so that
   * `start` is genuine, and `apply` (which disarms on any other entry —
   * see the rationale there) has no guarantee one lands first.
   */
  updateApprovalStatus: (key: K, requestId: string, status: ChatApprovalStatus, resolvedByName?: string | null) => void;
  /** Run reducer commands (non-wire mutations), then sync. Force-flushes deltas. */
  mutate: <T>(key: K, fn: (reducer: ChatStreamReducer) => T) => T;
  /** Read-modify-write on the thread, delegated to the reducer. */
  mutateThread: (key: K, op: (messages: ChatMessage[]) => ChatMessage[]) => void;
  /** Upsert by id: replace the row carrying `message.id`, else append. */
  upsertMessage: (key: K, message: ChatMessage) => void;
  /** Shallow-patch the row carrying `id`. No-op when it is absent. */
  patchMessage: (key: K, id: string, updates: Partial<ChatMessage>) => void;
  /** Drop the row carrying `id`. No-op when it is absent. */
  removeMessage: (key: K, id: string) => void;
  /**
   * Prepend an older history page, optionally shallow-patching the row that
   * straddles the page boundary (the merge both hosts run after fetching an
   * earlier page). No-op when nothing changes.
   */
  prependWithBoundaryMerge: (
    key: K,
    newMessages: ChatMessage[],
    boundaryMessageId?: string,
    boundaryUpdates?: Partial<ChatMessage>,
  ) => void;
  /**
   * Host typing indicator → the reducer's phase machine. Only 'idle' upgrades
   * to 'thinking': an open stream keeps ownership of the phase (this mirrors
   * the reducer's own agent-busy rule). Turning typing OFF always returns to
   * 'idle', which is what ends a host-driven indicator.
   */
  setTyping: (key: K, typing: boolean) => void;
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
   * blanket-dropping every echo bearing its own user id. `sentText` is what went to the backend when it is not what the
   * bubble says, since the echo comes back as what was sent.
   * TODO(CU-17tkuw635xx): `sentText` goes with `textForMingoBackend`; the bubble is the send again.
   */
  pushOptimisticSend: (key: K, message: ChatMessage, sentText?: string) => void;
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
  /**
   * Land what the delta batcher holds, so a read of the thread is the thread. A host that builds a thread to write back
   * (a history merge) reads after this: a write lays its copy over whatever landed since, and parts only grow, so the next
   * delta could never bring the lost text back.
   */
  flush: () => void;
  /** Drop the reducer + snapshot cache + decoder for `key`. Force-flushes first. */
  drop: (key: K) => void;
  /** Every key this mirror has seen and not dropped. */
  knownKeys: () => K[];
}

/**
 * createReducerMirror — the reducer-mirror scaffold both chat hosts (mingo
 * dialogs, ticket sides) share. Only the key type and the host's zustand
 * patch differ, so everything else lives here: reducer create-or-get,
 * snapshot-identity change detection, the
 * streamingId derivation, thread read-modify-write and cache teardown.
 *
 * REFERENCE STABILITY is the contract that matters: an unchanged reducer
 * snapshot short-circuits, and an unchanged message is the reducer's own object.
 * Break either and every inline approval/tool card remounts on each chunk.
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
 * (mingo: its `activeDialogId`; the ticket host deliberately declares NOTHING
 * — see the retention note in `ticket-details-store.ts`: two sides against a
 * cap of ten means eviction can never fire there) and everything else falls
 * back to LRU protection-by-recency plus the store's own
 * `streamingPhase !== 'idle'` guard, which already refuses to evict a live
 * stream.
 *
 * EVICTION OF A NON-DISPLAYED KEY IS THEN SAFE because the store PUBLISHES
 * it: the mirror injects `onEvict` when it builds the store (hence
 * `createStore` being a factory), and on that signal it parks the
 * `EvictedReducerState` the store hands
 * over. The next `getReducer` for the key — the call that materializes the
 * replacement instance — replays it through `initializeWithState`
 * before anything reads it, so the fresh reducer starts out holding exactly
 * what the host is already showing.
 *
 * THE THREAD ALONE IS NOT ENOUGH, which is why the whole parked state rides
 * along. A recreated reducer starts with `approvalStatuses = {}` and
 * `lastAppliedSeq = -Infinity`; refetching history does not restore either.
 * Drop them and a resolved approval whose `APPROVAL_RESULT` row is older than
 * the refetched page re-renders ACTIONABLE (the operator can re-approve an
 * already-executed tool), and a catch-up replay from the host's own cursor
 * re-applies events the dropped instance had already consumed (duplicate
 * rows). Parking is therefore UNCONDITIONAL — an empty thread with an
 * advanced seq cursor is exactly the case a "only park a non-empty thread"
 * gate used to throw away.
 *
 * Re-seeding, rather than suppressing the pristine-empty snapshot, is what
 * makes this correct in both directions. Suppression (comparing reducer OBJECT
 * IDENTITY across `getReducer` calls, then swallowing empty snapshots until
 * something non-empty arrives) got two cases wrong: an evicted key that
 * RESUMES STREAMING before the user re-selects it produces a first non-empty
 * snapshot containing only the new turn, which then REPLACED the host's full
 * thread; and a host write that legitimately empties a thread
 * (`setMessages([])`, removing the last row) was swallowed for as long as the
 * flag stayed armed. With the thread restored up front, an empty snapshot once
 * again means exactly what it says and is projected unconditionally.
 *
 * DELTA BATCHING is NOT reimplemented here: the lib's framework-free
 * `createDeltaBatcher` is the single implementation, shared with the React
 * wrapper (`useChatStreamReducer`). It coalesces consecutive same-type
 * deltas and lands them ~once per animation frame (always-armed ≤50ms timer
 * fallback, because rAF pauses in background tabs) — Anthropic emits 30-60
 * deltas/sec, and applying each synchronously re-renders the whole thread
 * that many times. `push` returns FALSE for a non-delta entry: the caller
 * then flushes and applies it itself, so ordering is preserved and turn
 * completion / dialog switch / unmount can never strand buffered text.
 */
export function createReducerMirror<K extends string>(config: ReducerMirrorConfig<K>): ReducerMirror<K> {
  const { createStore, identityFor, options, onSnapshot, siblingKeys } = config;

  const knownKeys = new Set<K>();
  const lastSyncedSnapshot = new Map<K, ChatReducerState>();
  const boundByKey = new Map<K, BoundMirror>();
  /** One stateful decoder per key: a text's slices meet across chunks. See `BoundMirror.decode`. */
  const decoderByKey = new Map<K, MingoDecoder>();
  /** Keys the host declared DISPLAYED, pushed to the store's policy-retain
   *  set — see the RETENTION note. */
  const activeKeys = new Set<K>();
  /** State parked by `onEvict`, replayed into the replacement reducer by the
   *  next `getReducer` — see the EVICTION note. */
  const reseedByKey = new Map<K, EvictedReducerState>();
  /** Per-key eviction counter published on `BoundMirror.evictionEpoch`. */
  const evictionEpochByKey = new Map<K, number>();
  /** Keys whose reducer is holding an armed adopt-once flag, waiting for the
   *  replayed `start` that `hydrate` armed it for. `apply` disarms on the
   *  first entry that turns out not to be one. */
  const awaitingAdopt = new Set<K>();

  /** Inverse of `identityFor`, over the keys this mirror knows. Only used to
   *  translate the store's `(dialogId, side)` eviction signal back into `K`;
   *  the sets involved are per-host and tiny (mingo caps at the store's ten
   *  reducers, tickets has two). */
  function keyForIdentity(dialogId: string, side: ChatDialogSide): K | undefined {
    for (const key of knownKeys) {
      const identity = identityFor(key);
      if (identity.dialogId === dialogId && identity.side === side) return key;
    }
    return undefined;
  }

  const store = createStore({
    onEvict: (dialogId: string, side: ChatDialogSide, parked: EvictedReducerState) => {
      const key = keyForIdentity(dialogId, side);
      if (key === undefined) return;
      // Park rather than re-seed here: `onEvict` fires from INSIDE the store's
      // `getReducer`, before the replacement instance for this key exists (and
      // possibly while another key is being resolved). The mirror's own
      // `getReducer` does the seeding.
      //
      // UNCONDITIONAL — see the EVICTION note. The approval statuses, the seq
      // cursor and the armed optimistic echoes are worth parking even when the
      // thread is empty. The reducer drops expired echoes and re-caps on restore.
      reseedByKey.set(key, parked);
      // Bump BEFORE dropping the memoized handle: the next `bind(key)` builds
      // a fresh `BoundMirror` carrying the new epoch, which is what re-arms
      // the consumers' one-shot effects against the replacement instance.
      evictionEpochByKey.set(key, (evictionEpochByKey.get(key) ?? 0) + 1);
      boundByKey.delete(key);
      lastSyncedSnapshot.delete(key);
    },
  });

  // The batcher applies against the key it FLUSHED, which on a key change is
  // the PREVIOUS key — never assume it is the key currently being handled.
  // `applyOne` records it; `onFlushed` (which fires for explicit flushes AND
  // for the rAF/timer-scheduled ones) re-projects exactly that key.
  let flushedKey: K | null = null;

  const batcher: DeltaBatcher<K> = createDeltaBatcher<K>({
    applyOne: (delta: DeltaEntry, key: K | undefined) => {
      if (key === undefined) return;
      flushedKey = key;
      const { dialogId, side } = identityFor(key);
      // Through the MIRROR's `getReducer`, not `store.apply`'s implicit one:
      // that is the call that consumes a parked re-seed. A buffered key is by
      // definition still 'idle' (its deltas have not landed), hence evictable,
      // so a later `apply(otherKey, …)` can evict it and then replay this
      // buffer into a fresh EMPTY reducer — after which `onFlushed` → `sync`
      // WOULD find the parked thread and `setMessages` right over the delta
      // just applied. Seeding first makes "no store write for a key precedes
      // its re-seed" hold by construction rather than by call ordering.
      getReducer(key);
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
    // This is the first look at the replacement instance for an evicted key —
    // restore the parked state before any caller reads it, so the resumed
    // stream appends to the host's full thread instead of truncating it, a
    // resolved approval stays resolved, and the seq gate keeps rejecting the
    // events the dropped instance had already applied.
    const parked = reseedByKey.get(key);
    if (parked !== undefined) {
      reseedByKey.delete(key);
      // `null` keeps the fresh reducer's (empty) thread — the parked one had
      // nothing to restore, and the statuses/cursor/echoes still must be.
      reducer.initializeWithState(parked.messages.length > 0 ? parked.messages : null, {
        approvalStatuses: parked.approvalStatuses,
        lastAppliedSeq: parked.lastAppliedSeq,
        // Re-arms own-echo suppression for a send that was still in flight at
        // eviction time; without it the pending `MESSAGE_REQUEST` echo renders
        // a SECOND copy of the user's bubble. Expiry/cap are the reducer's job.
        pendingEchoes: parked.pendingEchoes,
      });
    }
    return reducer;
  }

  /** Push `activeKeys` to the store's policy-retain set (which retains the
   *  additions before releasing the removals, so a key present across a swap
   *  never dips to zero retains). */
  function pushRetention(): void {
    store.setRetained(
      [...activeKeys].map(key => {
        const { dialogId, side } = identityFor(key);
        return { dialogId, side };
      }),
    );
  }

  function setActiveKeys(keys: readonly K[]): void {
    activeKeys.clear();
    for (const key of keys) activeKeys.add(key);
    pushRetention();
  }

  function sync(key: K): void {
    getReducer(key);
    const { dialogId, side } = identityFor(key);
    const snap = store.getSnapshot(dialogId, side);
    if (lastSyncedSnapshot.get(key) === snap) return;
    lastSyncedSnapshot.set(key, snap);

    const { messages } = snap;
    const phase = snap.streamingPhase;
    const last = messages[messages.length - 1];
    const streamingId = phase === 'streaming' && last?.role === 'assistant' ? last.id : null;

    onSnapshot(key, { messages, phase, streamingId, state: snap });
  }

  /**
   * THE history-hydration door — see `HydrateOptions` for the three steps and
   * why they may not be split across call sites.
   */
  function hydrate(key: K, messages: readonly ChatMessage[], hydrateOptions?: HydrateOptions): void {
    discardHeldTextOfReplacedTurn(key, messages);
    // The lib's one incompleteness rule, shared with the NATS adapter: it walks the
    // trailing consecutive assistant run and reports whether it is still unfinished
    // (pending approval, executing tool, open compaction).
    const extras = extractIncompleteTailState(messages);
    let armAdopt = extras !== undefined && hydrateOptions?.expectingReplay !== false;

    mutate(key, reducer => {
      // A turn the reducer is streaming owns its bubble: the thread is
      // written, but steps 2 and 3 are skipped. A merge landing mid-turn (a
      // history refetch while a replay is still arriving) puts the live bubble
      // after the NEWEST persisted turn, so the trailing assistant run spans
      // two turns, and adopting from it would rewrite the live bubble as that
      // persisted turn plus the streaming one.
      //
      // 'streaming' exactly, not "not idle": only a `start` raises it and
      // only the turn's end lowers it. 'thinking' is also what step 2 restores
      // for an agent-busy tail with NO turn open, and a second hydrate of that
      // tail (cached pages, then fresh ones) must seed and arm like the first,
      // or the replayed `start` opens a bubble beside the partial one.
      const turnOpen = reducer.state.streamingPhase === 'streaming';
      reducer.initializeWithState([...messages]);
      if (turnOpen) {
        // The `start` that opened it consumed any armed flag already.
        armAdopt = false;
        disarmAdopt(key, reducer);
        return;
      }
      // Second call, `null` thread: leaves the thread just written untouched.
      //
      // This is what restores the activity indicator: the extractor stamps
      // `agentBusy` on an unfinished tail that is the AGENT's work (a tool left
      // mid-flight, an approved command still running, an open compaction) and
      // NOT on one that is blocked on the user, and the reducer raises its own
      // phase off that flag. Nothing on the wire would do it — the run's
      // EXECUTING chunk is long past by reload time and its EXECUTED one may be
      // minutes away. Deriving it here instead would give this host a private
      // copy of a rule the Tauri client needs too.
      if (extras) reducer.initializeWithState(null, extras);
      reducer.armAdoptTrailingAssistant(armAdopt);
    });

    if (armAdopt) awaitingAdopt.add(key);
    else awaitingAdopt.delete(key);
  }

  /**
   * The decoder holds a text's tail back while it could still be a token (an open code span, an open bracket, a space
   * before a chip), and that tail continues the message it was writing. When the history took that message's place, the
   * persisted row already says it: flushed later, it would be written twice, into the answer or as a stray bubble of its
   * own. A live bubble the merge kept stays, and keeps its tail, because the next chunk finishes it.
   *
   * Read before `mutate`: its flush moves the live bubble past the copy the host merged from.
   *
   * TODO(CU-17tkuw635xx): goes with the lib's old text writer (`old-wire.ts`) and `MingoDecoder.discardHeld`. Only a token
   * is ever held; with no old tokens the decoder has no tail.
   */
  function discardHeldTextOfReplacedTurn(key: K, messages: readonly ChatMessage[]): void {
    const decoder = decoderByKey.get(key);
    if (!decoder) return;
    const { dialogId, side } = identityFor(key);
    const assistantRows = store.getSnapshot(dialogId, side).messages.filter(message => message.role === 'assistant');
    const writing = assistantRows.at(-1);
    if (!writing) return;
    const copy = messages.find(message => message.id === writing.id);
    if (!copy || textOfParts(copy.parts) !== textOfParts(writing.parts)) decoder.discardHeld();
  }

  /** Clears both halves of adopt-once. Runs inside the caller's `mutate`, and
   *  writes the reducer even when the set no longer holds the key: the seq
   *  gate can drop a `start` after `apply` has seen it, so the set alone
   *  cannot say whether the reducer's flag is still armed. */
  function disarmAdopt(key: K, reducer: ChatStreamReducer): void {
    awaitingAdopt.delete(key);
    reducer.armAdoptTrailingAssistant(false);
  }

  function updateApprovalStatus(
    key: K,
    requestId: string,
    status: ChatApprovalStatus,
    resolvedByName?: string | null,
  ): void {
    mutate(key, reducer => {
      disarmAdopt(key, reducer);
      reducer.projectApprovalResolution(requestId, status, resolvedByName);
    });
  }

  function apply(key: K, entry: ChatStreamEntry): void {
    // Adopt-once has a ONE-ENTRY life (see `HydrateOptions.expectingReplay`).
    // The flag exists for a REPLAYED `start`; anything else arriving first
    // means no replay is re-streaming this turn, and a flag left armed would
    // hand adoption to the next genuine turn — which would then overwrite a
    // completed bubble instead of opening its own. A `start` is left to
    // the reducer, which consumes the flag; the key stays until the next entry
    // of another kind clears both halves — see `disarmAdopt` for why the set
    // alone cannot say the flag is spent (a no-op sync when it is).
    if (awaitingAdopt.has(key) && !entry.chunks.some(chunk => chunk.type === 'start')) {
      mutate(key, reducer => {
        disarmAdopt(key, reducer);
      });
    }
    // ORDER IS LOAD-BEARING: a pending batch must land BEFORE
    // `getReducer(key)`. The dialog store evicts least-recently-used
    // reducers, so resolving a NEW key's reducer first can evict the pending
    // key's — and the flush would then replay buffered text into a freshly
    // recreated, empty one. `batcher.push` performs the key-change flush
    // internally, which is exactly why it is called before `getReducer`.
    const queued = batcher.push(entry, key);
    getReducer(key);
    if (queued) return;
    // `push` returned false: not a delta. Per the batcher contract the caller
    // flushes and applies it itself, so completion / approval / error entries
    // always land on fully-applied delta state.
    batcher.flush();
    // Non-delta entries are the only ones the store projects across keys, so
    // this is where (and the only place) siblings must exist and re-sync.
    // Materializing them AFTER the flush keeps the documented
    // flush-before-getReducer ordering intact for every key involved.
    const siblings = siblingKeys?.(key) ?? [];
    for (const sibling of siblings) {
      if (sibling !== key) getReducer(sibling);
    }
    const { dialogId, side } = identityFor(key);
    store.apply(dialogId, side, entry);
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

  /**
   * Read-modify-write on the thread. `op` returning its INPUT array
   * unchanged is the no-op convention — every recipe below leans on it, which
   * is the whole reason they live here rather than being re-derived (with
   * drifting no-op handling) in each host store.
   */
  function mutateThread(key: K, op: (messages: ChatMessage[]) => ChatMessage[]): void {
    mutate(key, reducer => {
      const current = reducer.state.messages;
      const next = op(current);
      if (next === current) return;
      reducer.setMessages(next);
    });
  }

  function upsertMessage(key: K, message: ChatMessage): void {
    mutateThread(key, current => {
      const idx = current.findIndex(m => m.id === message.id);
      if (idx === -1) return [...current, message];
      const updated = [...current];
      updated[idx] = message;
      return updated;
    });
  }

  function patchMessage(key: K, id: string, updates: Partial<ChatMessage>): void {
    mutateThread(key, current => {
      const idx = current.findIndex(m => m.id === id);
      if (idx === -1) return current;
      const updated = [...current];
      updated[idx] = { ...updated[idx], ...updates };
      return updated;
    });
  }

  function removeMessage(key: K, id: string): void {
    mutateThread(key, current => {
      const filtered = current.filter(m => m.id !== id);
      return filtered.length === current.length ? current : filtered;
    });
  }

  function prependWithBoundaryMerge(
    key: K,
    newMessages: ChatMessage[],
    boundaryMessageId?: string,
    boundaryUpdates?: Partial<ChatMessage>,
  ): void {
    mutateThread(key, current => {
      let messages = current;
      if (boundaryMessageId && boundaryUpdates) {
        const idx = messages.findIndex(m => m.id === boundaryMessageId);
        if (idx !== -1) {
          messages = [...messages];
          messages[idx] = { ...messages[idx], ...boundaryUpdates };
        }
      }
      return newMessages.length > 0 ? [...newMessages, ...messages] : messages;
    });
  }

  /** The typing→phase rule, owned once. See `ReducerMirror.setTyping`. */
  function setTyping(key: K, typing: boolean): void {
    mutate(key, reducer => {
      if (!typing) {
        reducer.setPhase('idle');
        return;
      }
      if (reducer.state.streamingPhase === 'idle') reducer.setPhase('thinking');
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
   * swap the reducer's generic rows for the host's single
   * rich bubble — the host bubble carries name / avatar / contextItems the
   * reducer's bare row does not, and the hosts drive their own typing
   * indicator, so the trailing assistant placeholder (and the phase flip
   * `pushOptimisticSend` performs) must not leak into the mirror.
   *
   * What the decoder still holds of a turn that ended with no MESSAGE_END (a crash, a lost chunk) goes in that turn's bubble
   * first: the send moves the thread on, and the next chunk that closes it would write it below the new message.
   *
   * TODO(CU-17tkuw635xx): `sentText` goes with `textForMingoBackend`, `closeHeld` with the lib's old text writer.
   */
  function pushOptimisticSend(key: K, message: ChatMessage, sentText?: string): void {
    mutate(key, reducer => {
      const held = decoderByKey.get(key)?.closeHeld();
      if (held) reducer.apply(held);
      const { messages, streamingPhase } = reducer.state;
      reducer.pushOptimisticSend(sentText ?? textOfParts(message.parts));
      reducer.setMessages([...messages, message]);
      reducer.setPhase(streamingPhase);
    });
  }

  function decoderOf(key: K): MingoDecoder {
    const known = decoderByKey.get(key);
    if (known) return known;
    const decoder = createMingoDecoder();
    decoderByKey.set(key, decoder);
    return decoder;
  }

  function bind(key: K): BoundMirror {
    const existing = boundByKey.get(key);
    if (existing) return existing;
    const bound: BoundMirror = {
      decode: raw => decoderOf(key).decode(raw),
      apply: entry => apply(key, entry),
      hydrate: (messages, hydrateOptions) => hydrate(key, messages, hydrateOptions),
      mutate: fn => {
        mutate(key, fn);
      },
      mergeApprovalStatuses: statuses => mergeApprovalStatuses(key, statuses),
      evictionEpoch: evictionEpochByKey.get(key) ?? 0,
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
    if (activeKeys.delete(key)) pushRetention();
    store.remove(dialogId, side);
    lastSyncedSnapshot.delete(key);
    // The sequence restarts with the reducer, and a decoder remembers the sequence it read: an old one would answer every
    // replayed chunk with nothing.
    decoderByKey.delete(key);
    // A dropped key is intentionally gone — the next `getReducer` builds a
    // fresh reducer that the host is expected to seed, so any state parked
    // by an earlier eviction must NOT be replayed into it.
    reseedByKey.delete(key);
    evictionEpochByKey.delete(key);
    knownKeys.delete(key);
  }

  // `getReducer` and `sync` stay module-private (`apply` is reachable only
  // pre-curried, via `bind`). An EXTERNAL `getReducer` would CONSUME a parked
  // post-eviction re-seed — `reseedByKey.delete` + `initializeWithState` — without the
  // `sync` that is supposed to follow it, so the host store would keep showing
  // its pre-eviction thread with no snapshot ever republishing it.
  return {
    store,
    hydrate,
    updateApprovalStatus,
    setActiveKeys,
    mutate,
    mutateThread,
    upsertMessage,
    patchMessage,
    removeMessage,
    prependWithBoundaryMerge,
    setTyping,
    mergeApprovalStatuses,
    pushOptimisticSend,
    bind,
    flush: flushDeltas,
    drop,
    knownKeys: () => [...knownKeys],
  };
}

// ─── Shared reducer options ─────────────────────────────────────────────────

/** Late-bound, per-key host handlers: the model badge. */
export interface NatsMirrorHandlers {
  onMetadata?: (metadata: ChatModelMetadata) => void;
}

/** Model-badge side-channel payload (kept outside the reducer state). */
export interface ChatModelMetadata {
  modelDisplayName: string;
  modelName: string;
  providerName: string;
  contextWindow: number;
}

/**
 * The `ChatStreamReducerOptions` block both NATS hosts had verbatim.
 * `handlersFor` is consulted at CALL time (not creation time), so hosts can
 * keep late-binding their handlers into a per-key Map.
 *
 * `onMetadata` rides the reducer's own `onMetadata` EFFECT rather than being
 * re-derived from the raw chunk by each host — the reducer already maps the
 * metadata to exactly this shape; only the app's non-optional string /
 * number fallbacks are applied here.
 */
export function natsMirrorOptions<K extends string>(
  handlersFor: (key: K) => NatsMirrorHandlers | undefined,
  // Thunk, and PASSED THROUGH as one (see the `selfUserId` note in the
  // returned options) — the signed-in user is not known at module load.
  selfUserId: () => string | undefined = () => undefined,
): (key: K) => ChatStreamReducerOptions {
  return key => ({
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
    //
    // The THUNK is handed to the reducer verbatim, NOT invoked here: reducer
    // options are consulted once, at creation, and every reducer these hosts
    // create is long-lived (mingo's active dialog and both ticket sides are
    // retained for the store's lifetime). A reducer created before auth
    // rehydration — or surviving a logout / login-as-a-different-user without
    // a reload — would otherwise keep `undefined`/stale forever and silently
    // disable the author guard. The lib resolves it when the chunk lands.
    selfUserId,
    onEffect: (effect: ChatReducerEffect) => {
      if (effect.name !== 'onMetadata') return;
      const [args] = effect.args;
      handlersFor(key)?.onMetadata?.({
        modelDisplayName: args.modelDisplayName ?? args.modelName ?? '',
        modelName: args.modelName ?? '',
        providerName: args.providerName ?? '',
        contextWindow: args.contextWindow ?? 0,
      });
    },
  });
}
