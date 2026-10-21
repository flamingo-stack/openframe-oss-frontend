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

function forgetHeight(): void {
  try {
    window.localStorage.removeItem(HEIGHT_KEY);
  } catch {
    // Blocked storage: nothing was kept.
  }
}

function writeHeight(height: number): void {
  try {
    window.localStorage.setItem(HEIGHT_KEY, String(Math.round(height)));
  } catch {
    // Private mode or blocked storage: the sheet opens at its default share next time.
  }
}

/** `trailingSlash: true` puts a slash after every path; compare without it. */
function trimSlash(pathname: string): string {
  return pathname.replace(/\/+$/, '') || '/';
}

/**
 * The conversation sheet over a page in the Mingo-first shell (`MingoComposerSheet`):
 * the open chat, raised from the docked composer, with the page left beneath it.
 *
 * - `open` — the sheet is up. Only on a plain page; Mingo's home and the chat page
 *   show the chat their own way and ignore it.
 * - `openAfterNavigation` — open on the page the next navigation lands on, once:
 *   a Getting Started chip opens its section and Mingo's answer there, and "Back to
 *   page" from a chat opened in full. `askedFrom` is the path it was asked on: the
 *   sheet is up from the first frame of any other page (`isSheetUp`), so the page
 *   never shows undimmed before the sheet rises over it.
 * - `height` — what the user dragged it to; null = the sheet's default share.
 * - `node` — the sheet's body, published by the sheet for the dock to portal the
 *   chat's header and thread into (`EmbeddableChat.threadContainer`).
 * - `fullFrom` — the page a chat was opened in full from ("Open as full chat"):
 *   the chat page offers the way back to it, the sheet raised again there. Kept
 *   while that chat's page is on screen, dropped on any other page. The sheet stays
 *   up until the chat page is reached, so the page does not show undimmed meanwhile.
 */
interface MingoSheetStore {
  open: boolean;
  openAfterNavigation: boolean;
  askedFrom: string | null;
  height: number | null;
  node: HTMLElement | null;
  fullFrom: { href: string; dialogId: string } | null;
  show: () => void;
  hide: () => void;
  showAfterNavigation: () => void;
  /** The location changed: the sheet closes, unless it was asked to open there. */
  navigated: () => void;
  setHeight: (height: number) => void;
  /** Back to the default height (the resize tab's double click): the dragged one is forgotten. */
  resetHeight: () => void;
  setNode: (node: HTMLElement | null) => void;
  /** The sheet gives way to the chat's own page; `href` is the page to come back to. */
  openFull: (href: string, dialogId: string) => void;
  clearFullFrom: () => void;
}

export const useMingoSheetStore = create<MingoSheetStore>()((set, get) => ({
  open: false,
  openAfterNavigation: false,
  askedFrom: null,
  height: readHeight(),
  node: null,
  fullFrom: null,
  show: () => set({ open: true, openAfterNavigation: false, askedFrom: null }),
  hide: () => set({ open: false, openAfterNavigation: false, askedFrom: null }),
  showAfterNavigation: () =>
    set({
      open: false,
      openAfterNavigation: true,
      askedFrom: typeof window === 'undefined' ? null : trimSlash(window.location.pathname),
    }),
  navigated: () => set({ open: get().openAfterNavigation, openAfterNavigation: false, askedFrom: null }),
  setHeight: height => {
    writeHeight(height);
    set({ height });
  },
  resetHeight: () => {
    forgetHeight();
    set({ height: null });
  },
  setNode: node => set({ node }),
  // `open` is left as it is: the sheet stays over the page until the chat page comes.
  openFull: (href, dialogId) => set({ openAfterNavigation: false, askedFrom: null, fullFrom: { href, dialogId } }),
  clearFullFrom: () => set({ fullFrom: null }),
}));

/**
 * Whether the sheet is up on `pathname`: open, or asked to open on the page a navigation
 * lands on and this is a page other than the one it was asked on — up from that page's
 * first frame, before `navigated` turns it into `open`. Routes that cannot show it
 * (`canShowSheet`) are the caller's to rule out.
 */
export function isSheetUp(
  state: Pick<MingoSheetStore, 'open' | 'openAfterNavigation' | 'askedFrom'>,
  pathname: string,
): boolean {
  if (state.open) return true;
  return state.openAfterNavigation && state.askedFrom !== trimSlash(pathname);
}
