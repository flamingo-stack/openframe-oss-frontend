import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

/**
 * Owns the Mingo drawer's open state (lifted out of `AppShell` so any page can
 * open it) plus two one-shot requests, both drained by the embedder
 * (`OpenframeEmbeddableChatEntry`) on the next render after the drawer opens:
 *   - `sendToMingo(prompt)` — queue a prompt, sent via `sendInNewDialog`.
 *   - `startNewChat()` — land on a fresh chat with nothing sent; relayed to the
 *     panel's imperative handle, since which view it shows is its own state.
 *
 * Each action clears the other's pending value, so a queued prompt can't fire
 * into a chat the user opened for something else.
 */
interface MingoLauncherStore {
  isOpen: boolean;
  /**
   * Whether a drawer is actually mounted to receive an open request — `AppShell`'s
   * `chatEnabled` (an unlocked workspace), published here so non-React callers can ask.
   *
   * Without it `setOpen(true)` from a notification click on a locked workspace sets
   * state nothing renders, while the caller goes on to mark the notification read —
   * consuming it with nothing to show. The subscription lock is not the only way to
   * lose the drawer either: the shell being unmounted entirely republishes `false` too.
   */
  canOpen: boolean;
  /** One-shot prompt to auto-send on the next drawer open; null once consumed. */
  pendingPrompt: string | null;
  /** One-shot "open on a fresh chat" request; false once consumed. */
  pendingNewChat: boolean;
  /**
   * The drawer was closed BY a navigation the same handler had just issued, so it
   * does not own the URL on this pass — the destination is already param-free.
   * Read by `useMingoDialogUrlSync`.
   *
   * Cleared by OPENS ONLY. A close must never clear it: the card-click path closes
   * the drawer twice in one handler (`navigate` → `closeForNavigation`, then the
   * lib panel's own `closeChat` → `setOpen(false)`), so a close that reset this
   * would erase the flag before the effect ever read it.
   */
  closedForNavigation: boolean;

  setOpen: (open: boolean) => void;
  setCanOpen: (canOpen: boolean) => void;
  toggle: () => void;
  close: () => void;
  /** {@link close} for a navigation this handler issued. See `closedForNavigation`. */
  closeForNavigation: () => void;
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
      canOpen: false,
      pendingPrompt: null,
      pendingNewChat: false,
      closedForNavigation: false,

      setOpen: open => set(open ? { isOpen: true, closedForNavigation: false } : { isOpen: false }, false, 'setOpen'),
      setCanOpen: canOpen => set({ canOpen }, false, 'setCanOpen'),
      toggle: () =>
        set(
          state => (state.isOpen ? { isOpen: false } : { isOpen: true, closedForNavigation: false }),
          false,
          'toggle',
        ),
      close: () => set({ isOpen: false }, false, 'close'),
      closeForNavigation: () => set({ isOpen: false, closedForNavigation: true }, false, 'closeForNavigation'),

      sendToMingo: prompt =>
        set(
          { isOpen: true, pendingPrompt: prompt, pendingNewChat: false, closedForNavigation: false },
          false,
          'sendToMingo',
        ),

      consumePendingPrompt: () => {
        const { pendingPrompt } = get();
        if (pendingPrompt !== null) set({ pendingPrompt: null }, false, 'consumePendingPrompt');
        return pendingPrompt;
      },

      startNewChat: () =>
        set(
          { isOpen: true, pendingNewChat: true, pendingPrompt: null, closedForNavigation: false },
          false,
          'startNewChat',
        ),

      consumePendingNewChat: () => {
        const { pendingNewChat } = get();
        if (pendingNewChat) set({ pendingNewChat: false }, false, 'consumePendingNewChat');
        return pendingNewChat;
      },
    }),
    { name: 'mingo-launcher-store' },
  ),
);
