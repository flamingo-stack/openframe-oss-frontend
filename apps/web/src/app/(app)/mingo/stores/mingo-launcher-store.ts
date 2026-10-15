import type { ChatPrefillDraft } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

/** What `draftToMingo` puts in the composer — relayed verbatim to the panel's `prefillDraft`. */
export type MingoDraft = ChatPrefillDraft;

/** A launcher request for the Mingo-first shell's composer dock (see `dockMounted`). */
export type MingoDockRequest =
  { kind: 'prompt'; prompt: string } | { kind: 'draft'; draft: MingoDraft } | { kind: 'newChat' };

/**
 * Owns the Mingo drawer's open state (lifted out of `AppShell` so any page can
 * open it) plus two one-shot requests, both drained by the embedder
 * (`OpenframeEmbeddableChatEntry`) on the next render after the drawer opens:
 *   - `sendToMingo(prompt)` — queue a prompt, sent via `sendInNewDialog`.
 *   - `draftToMingo(draft)` — queue a DRAFT: a fresh chat with the composer
 *     prefilled (text + attached context chips) and nothing sent — the user
 *     decides. Relayed to the panel's `prefillDraft` handle.
 *   - `startNewChat()` — land on a fresh chat with nothing sent; relayed to the
 *     panel's imperative handle, since which view it shows is its own state.
 *
 * Each action clears the others' pending values, so a queued prompt can't fire
 * into a chat the user opened for something else.
 *
 * In the Mingo-first shell there is no drawer: while its composer dock is mounted
 * (`dockMounted`) the same three requests queue ONE `dockRequest` instead, open
 * nothing, and the dock drains it (`useComposerLauncherDrain`).
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
  /** One-shot composer prefill for the next drawer open; null once consumed. */
  pendingDraft: MingoDraft | null;
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
  /**
   * Mingo v2: the chat is on screen as part of the layout (docked beside the page,
   * or opened over it). Docked, it shows a conversation while `isOpen` — which
   * there means "opened from the header" — is false, so the URL sync asks this
   * too. Always false with the overlay drawer.
   */
  panelShown: boolean;
  /**
   * Mingo v2: the panel is a column of the layout that cannot be put away (docked,
   * or dragged over the whole content area), so it stays on screen across
   * navigations, and its conversation with it. False while it was opened from the
   * header over the page, which a navigation still closes.
   */
  panelDocked: boolean;
  /**
   * Mingo-first shell: its composer dock is mounted — the session's only chat
   * surface, with no drawer to open. While true, `sendToMingo`, `draftToMingo`
   * and `startNewChat` queue a `dockRequest` instead of opening anything.
   */
  dockMounted: boolean;
  /** One-shot launcher request for the dock; null once consumed. */
  dockRequest: MingoDockRequest | null;

  setOpen: (open: boolean) => void;
  /**
   * Published by the dock. Mounting adopts a classic request queued just before it
   * (a launcher clicked while the shell variant was still loading). Unmounting keeps
   * an undrained request for the next dock: StrictMode unmounts and remounts it once
   * in development, and dropping there would lose what mounting just adopted.
   */
  setDockMounted: (mounted: boolean) => void;
  /** Read and clear the pending dock request (safe against double-consume). */
  consumeDockRequest: () => MingoDockRequest | null;
  setPanelShown: (shown: boolean) => void;
  setPanelDocked: (docked: boolean) => void;
  setCanOpen: (canOpen: boolean) => void;
  toggle: () => void;
  close: () => void;
  /** {@link close} for a navigation this handler issued. See `closedForNavigation`. */
  closeForNavigation: () => void;
  /** Open the drawer and queue a prompt for Mingo auto-send — the chat entry
   *  drains it straight into a fresh Mingo dialog via `sendInNewDialog`. With a
   *  dock mounted: a dock request instead (see `dockMounted`). */
  sendToMingo: (prompt: string) => void;
  /** Read and clear the pending prompt in one step (safe against double-consume). */
  consumePendingPrompt: () => string | null;
  /** Open the drawer on a fresh chat with the composer prefilled — nothing is sent.
   *  With a dock mounted: a dock request instead. */
  draftToMingo: (draft: MingoDraft) => void;
  /** Read and clear the pending draft in one step (safe against double-consume). */
  consumePendingDraft: () => MingoDraft | null;
  /** Open the drawer ON a new chat — clears the open conversation and, in the
   *  narrow panel, lands on the composer instead of the "Current Chats" list.
   *  With a dock mounted: a dock request instead. */
  startNewChat: () => void;
  /** Read and clear the pending new-chat request (safe against double-consume). */
  consumePendingNewChat: () => boolean;
}

/** A request for the dock, replacing every other pending one — the classic ones included. */
function toDock(request: MingoDockRequest) {
  return { dockRequest: request, pendingPrompt: null, pendingDraft: null, pendingNewChat: false };
}

/** The classic request queued before a dock mounted, as a dock request. Each action clears the others, so at most one is set. */
function adoptClassicRequest({
  pendingPrompt,
  pendingDraft,
  pendingNewChat,
}: Pick<MingoLauncherStore, 'pendingDraft' | 'pendingNewChat' | 'pendingPrompt'>): MingoDockRequest | null {
  if (pendingDraft) return { kind: 'draft', draft: pendingDraft };
  if (pendingPrompt) return { kind: 'prompt', prompt: pendingPrompt };
  if (pendingNewChat) return { kind: 'newChat' };
  return null;
}

export const useMingoLauncherStore = create<MingoLauncherStore>()(
  devtools(
    (set, get) => ({
      isOpen: false,
      canOpen: false,
      pendingPrompt: null,
      pendingDraft: null,
      pendingNewChat: false,
      closedForNavigation: false,
      panelShown: false,
      panelDocked: false,
      dockMounted: false,
      dockRequest: null,

      setDockMounted: mounted =>
        set(
          state => {
            if (!mounted) return { dockMounted: false };
            const adopted = adoptClassicRequest(state);
            // The classic action also opened a drawer this shell does not have.
            return adopted ? { dockMounted: true, isOpen: false, ...toDock(adopted) } : { dockMounted: true };
          },
          false,
          'setDockMounted',
        ),

      consumeDockRequest: () => {
        const { dockRequest } = get();
        if (dockRequest !== null) set({ dockRequest: null }, false, 'consumeDockRequest');
        return dockRequest;
      },

      setPanelShown: panelShown => set({ panelShown }, false, 'setPanelShown'),
      setPanelDocked: panelDocked => set({ panelDocked }, false, 'setPanelDocked'),
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
          state =>
            state.dockMounted
              ? toDock({ kind: 'prompt', prompt })
              : {
                  isOpen: true,
                  pendingPrompt: prompt,
                  pendingDraft: null,
                  pendingNewChat: false,
                  closedForNavigation: false,
                  dockRequest: null,
                },
          false,
          'sendToMingo',
        ),

      draftToMingo: draft =>
        set(
          state =>
            state.dockMounted
              ? toDock({ kind: 'draft', draft })
              : {
                  isOpen: true,
                  pendingDraft: draft,
                  pendingPrompt: null,
                  pendingNewChat: false,
                  closedForNavigation: false,
                  dockRequest: null,
                },
          false,
          'draftToMingo',
        ),

      consumePendingDraft: () => {
        const { pendingDraft } = get();
        if (pendingDraft !== null) set({ pendingDraft: null }, false, 'consumePendingDraft');
        return pendingDraft;
      },

      consumePendingPrompt: () => {
        const { pendingPrompt } = get();
        if (pendingPrompt !== null) set({ pendingPrompt: null }, false, 'consumePendingPrompt');
        return pendingPrompt;
      },

      startNewChat: () =>
        set(
          state =>
            state.dockMounted
              ? toDock({ kind: 'newChat' })
              : {
                  isOpen: true,
                  pendingNewChat: true,
                  pendingPrompt: null,
                  pendingDraft: null,
                  closedForNavigation: false,
                  dockRequest: null,
                },
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
