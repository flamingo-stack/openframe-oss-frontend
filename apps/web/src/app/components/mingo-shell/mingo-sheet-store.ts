import { create } from 'zustand';

/** Where the height the user dragged the sheet to is kept: a per-viewer convenience. */
const HEIGHT_KEY = 'of.mingo-sheet-height';

function readHeight(): number | null {
  try {
    const raw = typeof window === 'undefined' ? null : window.localStorage.getItem(HEIGHT_KEY);
    const value = raw === null ? Number.NaN : Number(raw);
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function writeHeight(height: number): void {
  try {
    window.localStorage.setItem(HEIGHT_KEY, String(Math.round(height)));
  } catch {
    // Private mode or blocked storage: the sheet opens at its default share next time.
  }
}

/**
 * The conversation sheet over a page in the Mingo-first shell (`MingoComposerSheet`):
 * the open chat, raised from the docked composer, with the page left beneath it.
 *
 * - `open` — the sheet is up. Only on a plain page; Mingo's home and the chat page
 *   show the chat their own way and ignore it.
 * - `openAfterNavigation` — open on the page the next navigation lands on, once:
 *   a Getting Started chip opens its section and Mingo's answer there.
 * - `height` — what the user dragged it to; null = the sheet's default share.
 * - `node` — the sheet's body, published by the sheet for the dock to portal the
 *   chat's header and thread into (`EmbeddableChat.threadContainer`).
 * - `fullFrom` — the page a chat was opened in full from ("Open as full chat"):
 *   the chat page offers the way back to it, the sheet raised again there. Kept
 *   while that chat's page is on screen, dropped on any other page.
 */
interface MingoSheetStore {
  open: boolean;
  openAfterNavigation: boolean;
  height: number | null;
  node: HTMLElement | null;
  fullFrom: { href: string; dialogId: string } | null;
  show: () => void;
  hide: () => void;
  showAfterNavigation: () => void;
  /** The location changed: the sheet closes, unless it was asked to open there. */
  navigated: () => void;
  setHeight: (height: number) => void;
  setNode: (node: HTMLElement | null) => void;
  /** The sheet gives way to the chat's own page; `href` is the page to come back to. */
  openFull: (href: string, dialogId: string) => void;
  clearFullFrom: () => void;
}

export const useMingoSheetStore = create<MingoSheetStore>()((set, get) => ({
  open: false,
  openAfterNavigation: false,
  height: readHeight(),
  node: null,
  fullFrom: null,
  show: () => set({ open: true, openAfterNavigation: false }),
  hide: () => set({ open: false, openAfterNavigation: false }),
  showAfterNavigation: () => set({ open: false, openAfterNavigation: true }),
  navigated: () => set({ open: get().openAfterNavigation, openAfterNavigation: false }),
  setHeight: height => {
    writeHeight(height);
    set({ height });
  },
  setNode: node => set({ node }),
  openFull: (href, dialogId) => set({ open: false, openAfterNavigation: false, fullFrom: { href, dialogId } }),
  clearFullFrom: () => set({ fullFrom: null }),
}));
