import type { ChatPrefillDraft } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { DialogIntent } from '../../tickets/constants';

/** What `draftToMingo` puts in the composer — relayed verbatim to the chat's `prefillDraft`. */
export type MingoDraft = ChatPrefillDraft;

/** A launcher request for the composer dock. */
export type MingoDockRequest =
  | { kind: 'prompt'; prompt: string }
  | { kind: 'draft'; draft: MingoDraft }
  | { kind: 'newChat' }
  | { kind: 'intent'; intent: DialogIntent }
  | { kind: 'open'; dialogId: string };

/**
 * Lets any page hand Mingo something to do, through the composer dock under every page:
 *   - `sendToMingo(prompt)` — send a prompt in a new chat (Meet Mingo, Help Center "Ask Mingo");
 *   - `draftToMingo(draft)` — a new chat with the composer prefilled (text + context chips)
 *     and nothing sent: the user decides ("Fix with Mingo" on an incident);
 *   - `startNewChat()` — land on Mingo's home with a new, empty chat;
 *   - `startIntentChat(intent)` — a new chat created to make one entity ("Generate with
 *     AI" on a create button): the server greets in it, nothing is sent;
 *   - `openDialog(id)` — an existing chat, over the page it was asked from (a notification,
 *     "Open Mingo Session"), as the classic shell's drawer opened it.
 *
 * Each queues ONE `dockRequest`, replacing a pending one, and the dock drains it
 * (`useComposerLauncherDrain`). A request raised before the dock mounts waits for it.
 */
interface MingoLauncherStore {
  /**
   * The dock is mounted: Mingo can take a request (an unlocked workspace on a SaaS tenant).
   * What a launcher asks before it offers itself, so it never offers a chat that cannot open.
   */
  dockMounted: boolean;
  /** One-shot launcher request for the dock; null once consumed. */
  dockRequest: MingoDockRequest | null;

  /**
   * Published by the dock. Unmounting keeps an undrained request for the next dock:
   * StrictMode unmounts and remounts it once in development.
   */
  setDockMounted: (mounted: boolean) => void;
  /** Read and clear the pending dock request (safe against double-consume). */
  consumeDockRequest: () => MingoDockRequest | null;
  sendToMingo: (prompt: string) => void;
  draftToMingo: (draft: MingoDraft) => void;
  startNewChat: () => void;
  startIntentChat: (intent: DialogIntent) => void;
  openDialog: (dialogId: string) => void;
}

export const useMingoLauncherStore = create<MingoLauncherStore>()(
  devtools(
    (set, get) => ({
      dockMounted: false,
      dockRequest: null,

      setDockMounted: dockMounted => set({ dockMounted }, false, 'setDockMounted'),

      consumeDockRequest: () => {
        const { dockRequest } = get();
        if (dockRequest !== null) set({ dockRequest: null }, false, 'consumeDockRequest');
        return dockRequest;
      },

      sendToMingo: prompt => set({ dockRequest: { kind: 'prompt', prompt } }, false, 'sendToMingo'),
      draftToMingo: draft => set({ dockRequest: { kind: 'draft', draft } }, false, 'draftToMingo'),
      startNewChat: () => set({ dockRequest: { kind: 'newChat' } }, false, 'startNewChat'),
      startIntentChat: intent => set({ dockRequest: { kind: 'intent', intent } }, false, 'startIntentChat'),
      openDialog: dialogId => set({ dockRequest: { kind: 'open', dialogId } }, false, 'openDialog'),
    }),
    { name: 'mingo-launcher-store' },
  ),
);
