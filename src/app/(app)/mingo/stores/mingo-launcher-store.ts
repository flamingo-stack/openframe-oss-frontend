import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

/**
 * Owns the Mingo chat drawer's open state (lifted out of `AppShell` so any page
 * can open it), plus the one-shot requests a page can queue for the next open.
 *
 * Two one-shot launcher entry points, both drained by the embedder
 * (`OpenframeEmbeddableChatEntry`) on the next render after the drawer opens:
 *   - `sendToMingo(prompt)` — queue a prompt (e.g. the onboarding "Meet Mingo"
 *     quick-action chips); the embedder sends it via `sendInNewDialog`.
 *   - `startNewChat()` — just land on a fresh chat, nothing sent (the "Meet
 *     Mingo" step's own button). The embedder relays it to the panel's
 *     imperative handle, because "show the composer" is the panel's own view
 *     state, not something the host can set.
 *
 * The two are mutually exclusive by construction — each action clears the
 * other's pending value — so a queued prompt can never fire into a chat the
 * user opened for something else, and vice versa.
 */
interface MingoLauncherStore {
  isOpen: boolean;
  /** One-shot prompt to auto-send on the next drawer open; null once consumed. */
  pendingPrompt: string | null;
  /** One-shot "open on a fresh chat" request; false once consumed. */
  pendingNewChat: boolean;

  setOpen: (open: boolean) => void;
  toggle: () => void;
  close: () => void;
  /** Open the drawer and queue a prompt for Mingo auto-send — the chat entry
   *  drains it straight into a fresh Mingo dialog via `sendInNewDialog`. */
  sendToMingo: (prompt: string) => void;
  /** Read and clear the pending prompt in one step (safe against double-consume). */
  consumePendingPrompt: () => string | null;
  /** Open the drawer ON a new chat — clears the open conversation and, in the
   *  narrow panel, lands on the composer instead of the "Current Chats" list. */
  startNewChat: () => void;
  /** Read and clear the pending new-chat request (safe against double-consume). */
  consumePendingNewChat: () => boolean;
}

export const useMingoLauncherStore = create<MingoLauncherStore>()(
  devtools(
    (set, get) => ({
      isOpen: false,
      pendingPrompt: null,
      pendingNewChat: false,

      setOpen: open => set({ isOpen: open }, false, 'setOpen'),
      toggle: () => set(state => ({ isOpen: !state.isOpen }), false, 'toggle'),
      close: () => set({ isOpen: false }, false, 'close'),

      sendToMingo: prompt => set({ isOpen: true, pendingPrompt: prompt, pendingNewChat: false }, false, 'sendToMingo'),

      consumePendingPrompt: () => {
        const { pendingPrompt } = get();
        if (pendingPrompt !== null) set({ pendingPrompt: null }, false, 'consumePendingPrompt');
        return pendingPrompt;
      },

      startNewChat: () => set({ isOpen: true, pendingNewChat: true, pendingPrompt: null }, false, 'startNewChat'),

      consumePendingNewChat: () => {
        const { pendingNewChat } = get();
        if (pendingNewChat) set({ pendingNewChat: false }, false, 'consumePendingNewChat');
        return pendingNewChat;
      },
    }),
    { name: 'mingo-launcher-store' },
  ),
);
