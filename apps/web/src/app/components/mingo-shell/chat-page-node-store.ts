import { create } from 'zustand';

/**
 * The DOM node the Mingo-first chat page (`/mingo/chat`) publishes for the docked `EmbeddableChat`
 * to portal its header + thread into (`threadContainer`). The page sets it through a ref callback,
 * so it reverts to `null` on unmount; the dock reads it and passes `null` — never `undefined`,
 * which would switch the chat back to its classic in-place layout and remount the composer.
 */
interface ChatPageNodeStore {
  node: HTMLElement | null;
  setNode: (node: HTMLElement | null) => void;
}

export const useChatPageNodeStore = create<ChatPageNodeStore>()(set => ({
  node: null,
  setNode: node => set({ node }),
}));
