import type { MingoUnifiedChat } from '../hooks/use-mingo-unified-chat-state';

/**
 * The session's chat state as a surface reads it: everything
 * `useMingoUnifiedChatState()` returns except the live-tail bindings, which only
 * the provider renders (`<DialogSubscription>`, once per session). A second
 * subscription for the same dialog would apply every chunk twice.
 */
export type MingoChatState = Omit<MingoUnifiedChat, 'subscription'>;

export interface MingoChatSnapshot {
  /** Null while nothing runs: no surface registered, the provider disabled, or the state failed. */
  chat: MingoChatState | null;
  /**
   * Why the state stopped. Kept until every surface is gone, so a remounted surface
   * (the dock's retry) starts a fresh state.
   */
  error: Error | null;
}

export const IDLE_MINGO_CHAT: MingoChatSnapshot = Object.freeze({ chat: null, error: null });

/**
 * Hands the one running chat state to every surface that reads it.
 *
 * An external store rather than React state on the provider: the state is
 * computed by a component rendered BESIDE the layout (it has to mount and unmount
 * with the surfaces without remounting the layout), so it cannot pass a value
 * down — it publishes one, and `useSyncExternalStore` re-renders exactly the
 * components that read it, not the shell around them.
 */
export interface MingoChatStore {
  getSnapshot: () => MingoChatSnapshot;
  subscribe: (listener: () => void) => () => void;
  publish: (chat: MingoChatState) => void;
  fail: (error: Error) => void;
  reset: () => void;
}

/** Field-by-field identity: the result object is rebuilt on every render, its fields are not. */
function isSameChat(a: MingoChatState, b: MingoChatState): boolean {
  const keys = Object.keys(a) as Array<keyof MingoChatState>;
  return keys.length === Object.keys(b).length && keys.every(key => Object.is(a[key], b[key]));
}

export function createMingoChatStore(): MingoChatStore {
  let snapshot = IDLE_MINGO_CHAT;
  const listeners = new Set<() => void>();

  const set = (next: MingoChatSnapshot) => {
    if (next === snapshot) return;
    snapshot = next;
    for (const listener of listeners) listener();
  };

  return {
    getSnapshot: () => snapshot,
    subscribe: listener => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    publish: chat => {
      if (snapshot.chat && isSameChat(snapshot.chat, chat)) return;
      set({ chat, error: null });
    },
    fail: error => set({ chat: null, error }),
    reset: () => set(IDLE_MINGO_CHAT),
  };
}
