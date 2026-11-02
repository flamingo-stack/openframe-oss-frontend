import { create } from 'zustand';

/**
 * Whether the phone burger drawer of the Mingo-first shell is open — `AppLayout`'s
 * controlled `mobileMenuOpen`, which the shell passes from here. The layout reports every
 * open and close it asks for (the burger, a nav entry, an in-layout drawer opening, and a
 * change of `sidebarConfig.currentPath`, i.e. any navigation); the shell's own controls
 * write here too: ⌘K opens it below md, and the drawer's slots close it when they act without moving the
 * location (New chat on home, the chat that is already open, an account item for the page
 * on screen).
 */
interface MobileMenuStore {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export const useMobileMenuStore = create<MobileMenuStore>()(set => ({
  open: false,
  setOpen: open => set({ open }),
}));

/** Close the phone drawer from an event handler; a no-op while it is closed (and from md up, where it is never open). */
export function closeMobileMenu(): void {
  useMobileMenuStore.getState().setOpen(false);
}
