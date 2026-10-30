import { create } from 'zustand';

/**
 * Ghost text for the docked composer (`EmbeddableChat.composerPreviewText`): what a chip
 * drawn outside the chat would send, shown in the composer while the chip is hovered or
 * focused — the preview the chat's own quick-action chips give. Mingo's home writes it
 * from its Quick Actions; the dock reads it.
 */
interface ComposerPreviewStore {
  text: string | null;
  show: (text: string) => void;
  /** Clears the preview, unless another chip has replaced it meanwhile. */
  hide: (text: string) => void;
  clear: () => void;
}

export const useComposerPreviewStore = create<ComposerPreviewStore>()(set => ({
  text: null,
  show: text => set({ text }),
  hide: text => set(state => (state.text === text ? { text: null } : state)),
  clear: () => set({ text: null }),
}));
