import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

/**
 * Dialogs with a manual context compaction in flight. `MingoCompactionWatchers`
 * runs one watcher per id: it opens the dialog's chunk stream, sends the request
 * once the stream is live, and finishes the id when the compaction turn ends.
 */
interface MingoCompactionStore {
  compactingDialogIds: string[];
  /** False when the dialog is already compacting. */
  startCompaction: (dialogId: string) => boolean;
  finishCompaction: (dialogId: string) => void;
  /** Drops every id, for when no watcher is left to finish them. */
  resetCompactions: () => void;
}

export const useMingoCompactionStore = create<MingoCompactionStore>()(
  devtools(
    (set, get) => ({
      compactingDialogIds: [],
      startCompaction: dialogId => {
        if (get().compactingDialogIds.includes(dialogId)) return false;
        set(state => ({ compactingDialogIds: [...state.compactingDialogIds, dialogId] }));
        return true;
      },
      finishCompaction: dialogId =>
        set(state => ({ compactingDialogIds: state.compactingDialogIds.filter(id => id !== dialogId) })),
      resetCompactions: () => set({ compactingDialogIds: [] }),
    }),
    { name: 'mingo-compaction-store' },
  ),
);
