import { create } from 'zustand';

/**
 * The channel between the chat page (`/mingo/chat`) and the composer dock.
 *
 * - `node`: the DOM node the page publishes for the docked `EmbeddableChat` to portal its
 *   header + thread into (`threadContainer`). The page sets it through a ref callback, so it
 *   reverts to `null` on unmount; the dock reads it and passes `null` — never `undefined`,
 *   which would switch the chat back to its in-place layout and remount the composer.
 * - `chatMounted`: the dock's chat module has loaded and mounted (it loads lazily, after the
 *   page). Until then nothing portals into the node, so the page draws the chat's skeleton.
 * - `threadReady`: the page's own say, after `chatMounted`: the conversation it opens has
 *   loaded, so the dock may portal into `node`. Until then the page keeps its skeleton, and a
 *   cold open shows one skeleton and then the chat — not the page's skeleton, the chat's own,
 *   then the messages under a placeholder title.
 */
interface ChatPageNodeStore {
  node: HTMLElement | null;
  setNode: (node: HTMLElement | null) => void;
  chatMounted: boolean;
  setChatMounted: (mounted: boolean) => void;
  threadReady: boolean;
  setThreadReady: (ready: boolean) => void;
}

export const useChatPageNodeStore = create<ChatPageNodeStore>()(set => ({
  node: null,
  setNode: node => set({ node }),
  chatMounted: false,
  setChatMounted: chatMounted => set({ chatMounted }),
  threadReady: false,
  setThreadReady: threadReady => set({ threadReady }),
}));
