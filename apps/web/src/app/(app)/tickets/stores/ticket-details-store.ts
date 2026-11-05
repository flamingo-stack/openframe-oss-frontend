import { type ChatMessage, textOfParts } from '@flamingo-stack/openframe-frontend-core/chat-protocol';
import {
  type ChatModelMetadata,
  type ChatStreamReducer,
  chatThreadReducerOptions,
  createChatDialogStore,
  createChatThreadStore,
} from '@flamingo-stack/openframe-frontend-core/components/chat';
import { create } from 'zustand';
import { useAuthStore } from '@/stores';

export type ChatSide = 'client' | 'admin';

/**
 * Each chat side is a lib reducer held in the lib's thread store (`createChatThreadStore`), keyed (dialog, side). The
 * dialog store's built-in cross-side projections (approval resolution by requestId, tool-execution merge by execId)
 * replace the app's both-sides fan-out. This zustand store survives as persistence/cache + identity: per-side seq
 * bookkeeping, approval-status map, and a READ MIRROR of each reducer snapshot so existing selectors keep working.
 *
 * Only one ticket dialog is open at a time (the view clears state on ticket switch/unmount), so the reducers use a
 * constant thread key — the two SIDES are the real keys.
 */
const TICKET_THREAD_KEY = 'ticket-details';

const metadataHandlerBySide = new Map<ChatSide, (metadata: ChatModelMetadata) => void>();

const BOTH_SIDES: readonly ChatSide[] = ['client', 'admin'];

/** Creation options for a side's reducer. The operator IS the admin: their own send echoes back as 'ADMIN'. */
const ticketReducerOptions = chatThreadReducerOptions<ChatSide>({
  ownEchoIncludesAdmin: true,
  selfUserId: () => useAuthStore.getState().user?.id,
  onMetadata: (side, metadata) => metadataHandlerBySide.get(side)?.(metadata),
});

/** The lib's thread store: this host supplies the key mapping, the sibling set and the zustand patch. Key = the chat
 *  SIDE (the thread key is constant: only one ticket dialog is open at a time). */
const threads = createChatThreadStore<ChatSide>({
  // `defaultCreateOptions` closes the store-level hole: a reducer first materialized by a bare `apply()` / `mutate()`
  // would otherwise be built WITHOUT `ownEchoIncludesAdmin` / `selfUserId` and keep them missing for its whole life
  // (creation options are consulted once), so every message a technician sends would render twice.
  createStore: storeOptions =>
    createChatDialogStore({
      ...storeOptions,
      defaultCreateOptions: (_dialogId: string, side: string) => ticketReducerOptions(side as ChatSide),
    }),
  identityFor: side => ({ dialogId: TICKET_THREAD_KEY, side }),
  // The dialog store's cross-side projections (approval resolution by
  // requestId, tool-execution merge by execId) land on the OTHER side's
  // reducer, so both sides must exist before an event lands and both must
  // re-sync after. The thread store owns that ordering.
  siblingKeys: () => BOTH_SIDES,
  options: ticketReducerOptions,
  onSnapshot: (side, { messages, phase, streamingId, state: snap }) => {
    useTicketDetailsStore.setState(state => {
      const nextSide: SideState = {
        ...state[side],
        messages,
        isTyping: phase !== 'idle',
        streamingId,
      };

      // Approval resolutions the reducer learned from stream events flow
      // back into the shared status map (history processing reads it).
      // ADDITIVE ON PURPOSE — only 'approved'/'rejected' are copied IN,
      // nothing is ever removed: this map is the WIDER record (it also
      // carries statuses learned from history processing and from the other
      // side), so a blanking write would re-arm buttons for approvals this
      // host knows were resolved.
      let approvalStatuses = state.approvalStatuses;
      for (const [id, status] of Object.entries(snap.approvalStatuses)) {
        if ((status === 'approved' || status === 'rejected') && approvalStatuses[id] !== status) {
          if (approvalStatuses === state.approvalStatuses) approvalStatuses = { ...approvalStatuses };
          approvalStatuses[id] = status;
        }
      }

      return side === 'client' ? { client: nextSide, approvalStatuses } : { admin: nextSide, approvalStatuses };
    });
  },
});

/** The dialog store behind this host's two side reducers (built by the thread store). */
export const ticketChatDialogStore = threads.store;

/** Run reducer commands (non-wire mutations) against one side, then threads. */
export function mutateTicketSide<T>(side: ChatSide, fn: (reducer: ChatStreamReducer) => T): T {
  return threads.mutate(side, fn);
}

/** Pre-curried `{ decode, apply, mutate, mergeApprovalStatuses }` for one side.
 *  Identity is stable per side (memoized inside the thread store); `apply` needs
 *  no host wrapper — `siblingKeys` above tells the store to materialize and
 *  re-sync the other side itself. */
export const bindTicketSide = threads.bind;

/** NO retention here, deliberately. `setActiveKeys` declares what is
 *  currently DISPLAYED, and at module-init time no ticket is open at all — the
 *  old unconditional assertion contradicted that contract. It is also
 *  unnecessary: `ticketChatDialogStore` is this host's OWN dialog store and
 *  holds at most two reducers (one per side of the single open ticket) against
 *  an LRU cap of ten, so eviction can never fire here. Mingo, which keys by
 *  dialogId and really can exceed the cap, is the host that needs pinning. */

function dropSideCaches(side: ChatSide): void {
  threads.drop(side);
  metadataHandlerBySide.delete(side);
}

// ─── Zustand store (persistence/cache + identity + read mirror) ─────────────

interface SideState {
  /** Read mirror of the side reducer's message thread (app shape). */
  messages: ChatMessage[];
  /** Read mirror: reducer streamingPhase !== 'idle'. */
  isTyping: boolean;
  /** Id of the assistant bubble an open stream writes into (merge exemption). */
  streamingId: string | null;
  // Highest chunk `streamSeq` this client has consumed for the side (live or replayed). Compared
  // against history's max persisted seq in mergeHistoryWithRealtime to drop replayed synthetics
  // whose turns are already in history.
  highestStreamSeq: number;
}

function createSideState(): SideState {
  return {
    messages: [],
    isTyping: false,
    streamingId: null,
    highestStreamSeq: 0,
  };
}

export type ApprovalStatus = 'approved' | 'rejected';
export type ApprovalStatusMap = Record<string, ApprovalStatus>;

interface TicketDetailsStore {
  // Per-side state
  client: SideState;
  admin: SideState;

  approvalStatuses: ApprovalStatusMap;

  // Reset all chat-side state (e.g. on ticket switch)
  clearChatState: () => void;

  // Per-side message actions (delegate to the lib reducer)
  setMessages: (side: ChatSide, messages: ChatMessage[]) => void;
  prependMessages: (side: ChatSide, messages: ChatMessage[]) => void;
  prependWithBoundaryMerge: (
    side: ChatSide,
    newMessages: ChatMessage[],
    boundaryMessageId?: string,
    boundaryUpdates?: Partial<ChatMessage>,
  ) => void;
  addMessage: (side: ChatSide, message: ChatMessage) => void;
  /** Optimistic local send. Routed through the reducer so IT owns own-echo
   *  suppression (text-matched, one-shot) — a blanket "drop every echo with
   *  my user id" would also hide this user's sends from other tabs. */
  pushOptimisticSend: (side: ChatSide, message: ChatMessage) => void;
  updateMessage: (side: ChatSide, messageId: string, updates: Partial<ChatMessage>) => void;
  removeMessage: (side: ChatSide, messageId: string) => void;
  /** The thread as it stands, deltas still in the batcher included: what a history merge builds its write from. */
  getMessages: (side: ChatSide) => ChatMessage[];

  // Approvals
  /** Cross-message approval flip on one side (the reducer's projection). */
  updateApprovalStatusInMessages: (
    side: ChatSide,
    requestId: string,
    status: ApprovalStatus,
    resolvedByName?: string | null,
  ) => void;
  setApprovalStatus: (requestId: string, status: ApprovalStatus) => void;
  /**
   * Upsert PERSISTED resolutions into this store's status map — INCOMING
   * WINS, which is the opposite of the reducer-side merge this map eventually
   * feeds (`ChatThreadStore.mergeApprovalStatuses` → the reducer's
   * `mergeApprovalStatuses`, where stream-learned wins over persisted).
   * Deliberately not called `merge*`: the two rules must not read as one.
   */
  upsertApprovalStatuses: (entries: ApprovalStatusMap) => void;

  /** Late-bound per-side model badge handler: it rides the reducer's own metadata effect. */
  setMetadataHandler: (side: ChatSide, onMetadata: ((metadata: ChatModelMetadata) => void) | undefined) => void;

  // Typing (delegates to the reducer's phase machine)
  setTypingIndicator: (side: ChatSide, typing: boolean) => void;

  // Stream-seq coverage tracking (history/realtime dedupe)
  recordHighestStreamSeq: (side: ChatSide, seq: number) => void;
  getHighestStreamSeq: (side: ChatSide) => number;

  // Reset one side (e.g. on dialog switch)
  clearSide: (side: ChatSide) => void;
}

function produceSide(
  state: TicketDetailsStore,
  side: ChatSide,
  updater: (s: SideState) => SideState,
): Pick<TicketDetailsStore, 'client' | 'admin'> {
  const next = updater(state[side]);
  return side === 'client' ? { client: next, admin: state.admin } : { client: state.client, admin: next };
}

export const useTicketDetailsStore = create<TicketDetailsStore>((set, get) => ({
  client: createSideState(),
  admin: createSideState(),
  approvalStatuses: {},

  clearChatState: () => {
    dropSideCaches('client');
    dropSideCaches('admin');
    set({
      client: createSideState(),
      admin: createSideState(),
      approvalStatuses: {},
    });
  },

  // `threads.hydrate`, NOT a raw thread write — see `ChatThreadHydrateOptions`.
  // Per-side here, with the lib engine's first-page semantics: the paginated path goes through
  // `prependWithBoundaryMerge`.
  setMessages: (side, messages) => {
    threads.hydrate(side, messages);
  },

  prependMessages: (side, messages) => {
    mutateTicketSide(side, r => r.prependMessages(messages));
  },

  prependWithBoundaryMerge: (side, newMessages, boundaryMessageId, boundaryUpdates) => {
    threads.prependWithBoundaryMerge(side, newMessages, boundaryMessageId, boundaryUpdates);
  },

  addMessage: (side, message) => {
    threads.upsertMessage(side, message);
  },

  pushOptimisticSend: (side, message) => {
    threads.pushOptimisticSend(side, textOfParts(message.parts), { message });
  },

  updateMessage: (side, messageId, updates) => {
    threads.patchMessage(side, messageId, updates);
  },

  removeMessage: (side, messageId) => {
    threads.removeMessage(side, messageId);
  },

  getMessages: side => {
    threads.flush();
    return get()[side].messages;
  },

  updateApprovalStatusInMessages: (side, requestId, status, resolvedByName) => {
    threads.updateApprovalStatus(side, requestId, status, resolvedByName);
    get().setApprovalStatus(requestId, status);
  },

  setApprovalStatus: (requestId, status) =>
    set(state =>
      state.approvalStatuses[requestId] === status
        ? state
        : { approvalStatuses: { ...state.approvalStatuses, [requestId]: status } },
    ),

  upsertApprovalStatuses: entries =>
    set(state => {
      let changed = false;
      const next: ApprovalStatusMap = { ...state.approvalStatuses };
      for (const [id, status] of Object.entries(entries)) {
        if (next[id] !== status) {
          next[id] = status;
          changed = true;
        }
      }
      return changed ? { approvalStatuses: next } : state;
    }),

  setMetadataHandler: (side, onMetadata) => {
    if (onMetadata) metadataHandlerBySide.set(side, onMetadata);
    else metadataHandlerBySide.delete(side);
  },

  setTypingIndicator: (side, typing) => {
    threads.setTyping(side, typing);
  },

  recordHighestStreamSeq: (side, seq) =>
    set(state =>
      seq <= state[side].highestStreamSeq ? state : produceSide(state, side, s => ({ ...s, highestStreamSeq: seq })),
    ),

  getHighestStreamSeq: side => get()[side].highestStreamSeq,

  clearSide: side => {
    dropSideCaches(side);
    set(state => produceSide(state, side, _s => createSideState()));
  },
}));
