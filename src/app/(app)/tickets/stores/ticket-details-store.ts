import type { Message as ChatMessage } from '@flamingo-stack/openframe-frontend-core';
import { type ChatStreamReducer, createChatDialogStore } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { create } from 'zustand';
import {
  createReducerMirror,
  type NatsMirrorHandlers,
  natsMirrorOptions,
  toUnifiedMessage,
} from '@/lib/chat-stream-thread';
import { featureFlags } from '@/lib/feature-flags';
import { useAuthStore } from '@/stores';

export type ChatSide = 'client' | 'admin';

/**
 * Phase 4 of the chat unification: each chat side is a lib
 * `createChatStreamReducer` instance held in a `createChatDialogStore`
 * keyed (dialog, side). The store's built-in cross-side projections
 * (approval resolution by requestId, tool-execution merge by execId)
 * replace the app's both-sides fan-out. This zustand store survives as
 * persistence/cache + identity: per-side seq bookkeeping, approval-status
 * map, and a converted READ MIRROR of each reducer snapshot so existing
 * selectors keep working.
 *
 * Only one ticket dialog is open at a time (the view clears state on
 * ticket switch/unmount), so the reducers use a constant thread key —
 * the two SIDES are the real keys.
 */
const TICKET_THREAD_KEY = 'ticket-details';

export const ticketChatDialogStore = createChatDialogStore();

const SIDE_IDENTITY: Record<ChatSide, { assistantName: string; assistantType: 'fae' | 'mingo' }> = {
  client: { assistantName: 'Fae', assistantType: 'fae' },
  admin: { assistantName: 'Mingo', assistantType: 'mingo' },
};

const handlersBySide = new Map<ChatSide, NatsMirrorHandlers>();

const BOTH_SIDES: readonly ChatSide[] = ['client', 'admin'];

/** All reducer-mirror scaffolding (create-or-get, retention, snapshot change
 *  detection, conversion cache, thread RMW, delta batching, approval-status
 *  merge, cross-side materialize + resync) lives in the shared
 *  `createReducerMirror` factory, and the NATS options block in
 *  `natsMirrorOptions` — this host supplies only the key mapping, the sibling
 *  set and the zustand patch. Mirror key = the chat SIDE (the thread key is
 *  constant: only one ticket dialog is open at a time). */
const mirror = createReducerMirror<ChatSide>({
  store: ticketChatDialogStore,
  identityFor: side => ({ dialogId: TICKET_THREAD_KEY, side, defaults: SIDE_IDENTITY[side] }),
  // The dialog store's cross-side projections (approval resolution by
  // requestId, tool-execution merge by execId) land on the OTHER side's
  // reducer, so both sides must exist before an event lands and both must
  // re-sync after. The mirror owns that ordering.
  siblingKeys: () => BOTH_SIDES,
  options: natsMirrorOptions<ChatSide>(
    side => handlersBySide.get(side),
    () => featureFlags.batchApproval.enabled(),
    () => useAuthStore.getState().user?.id,
  ),
  onSnapshot: (side, { messages, phase, streamingId, state: snap }) => {
    useTicketDetailsStore.setState(state => {
      const nextSide: SideState = {
        ...state[side],
        messages,
        isTyping: phase !== 'idle',
        streamingId,
      };

      // Approval resolutions the reducer learned from stream events flow
      // back into the shared status map (history processing + pending-card
      // extraction read it).
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

/** Run reducer commands (non-wire mutations) against one side, then mirror. */
export function mutateTicketSide<T>(side: ChatSide, fn: (reducer: ChatStreamReducer) => T): T {
  return mirror.mutate(side, fn);
}

/** Pre-curried `{ apply, mutate, mergeApprovalStatuses }` for one side.
 *  Identity is stable per side (memoized inside the mirror); `apply` needs no
 *  host wrapper — `siblingKeys` above tells the mirror to materialize and
 *  re-sync the other side itself. */
export const bindTicketSide = mirror.bind;

/** Read-modify-write on one side's app-shape thread. */
function mutateThread(side: ChatSide, op: (messages: ChatMessage[]) => ChatMessage[]): void {
  mirror.mutateThread(side, op);
}

function dropSideCaches(side: ChatSide): void {
  mirror.drop(side);
  handlersBySide.delete(side);
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
  getMessages: (side: ChatSide) => ChatMessage[];

  // Approvals
  /** Cross-message approval flip on one side (reducer accumulator + projection). */
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
   * feeds (`ReducerMirror.mergeApprovalStatuses` → the reducer's
   * `mergeApprovalStatuses`, where stream-learned wins over persisted).
   * Deliberately not called `merge*`: the two rules must not read as one.
   */
  upsertApprovalStatuses: (entries: ApprovalStatusMap) => void;

  /** Late-bound per-side handlers: approve/reject are stamped onto approval
   *  segments; `onMetadata` rides the reducer's own metadata effect. */
  setChatHandlers: (side: ChatSide, handlers: NatsMirrorHandlers) => void;

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

  setMessages: (side, messages) => {
    mutateTicketSide(side, r => r.setMessages(messages.map(m => toUnifiedMessage(m))));
  },

  prependMessages: (side, messages) => {
    mutateTicketSide(side, r => r.prependMessages(messages.map(m => toUnifiedMessage(m))));
  },

  prependWithBoundaryMerge: (side, newMessages, boundaryMessageId, boundaryUpdates) => {
    mutateThread(side, current => {
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
  },

  addMessage: (side, message) => {
    mutateThread(side, current => {
      const existingIndex = current.findIndex(m => m.id === message.id);
      if (existingIndex !== -1) {
        const updated = [...current];
        updated[existingIndex] = message;
        return updated;
      }
      return [...current, message];
    });
  },

  pushOptimisticSend: (side, message) => {
    mirror.pushOptimisticSend(side, message);
  },

  updateMessage: (side, messageId, updates) => {
    mutateThread(side, current => {
      const idx = current.findIndex(m => m.id === messageId);
      if (idx === -1) return current;
      const updated = [...current];
      updated[idx] = { ...updated[idx], ...updates };
      return updated;
    });
  },

  removeMessage: (side, messageId) => {
    mutateThread(side, current => {
      const filtered = current.filter(m => m.id !== messageId);
      return filtered.length === current.length ? current : filtered;
    });
  },

  getMessages: side => get()[side].messages,

  updateApprovalStatusInMessages: (side, requestId, status, resolvedByName) => {
    mutateTicketSide(side, r => r.updateApprovalStatus(requestId, status, resolvedByName));
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

  // MERGE, don't replace: approve/reject are registered by the ticket view
  // while `onMetadata` is registered by the per-side chunk processor, so a
  // wholesale set would let whichever ran last clobber the other.
  setChatHandlers: (side, handlers) => {
    handlersBySide.set(side, { ...handlersBySide.get(side), ...handlers });
  },

  setTypingIndicator: (side, typing) => {
    mutateTicketSide(side, r => {
      if (typing) {
        // Only 'idle' upgrades to 'thinking' — an open stream keeps
        // ownership of the phase (mirrors the reducer's agent-busy rule).
        if (r.state.streamingPhase === 'idle') r.setPhase('thinking');
      } else {
        r.setPhase('idle');
      }
    });
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
