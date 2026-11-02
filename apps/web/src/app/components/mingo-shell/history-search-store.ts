import { create } from 'zustand';

/**
 * Whether the chat-history search field in the Mingo-first sidebar is open. The shell opens it on
 * ⌘K / Ctrl+K (and un-collapses the sidebar); the history section (`MingoSidebarHistory`) renders
 * the field from it and closes it on Esc or blur while empty.
 */
interface HistorySearchStore {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export const useHistorySearchStore = create<HistorySearchStore>()(set => ({
  open: false,
  setOpen: open => set({ open }),
}));
