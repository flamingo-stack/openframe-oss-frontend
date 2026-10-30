import { create } from 'zustand';

/** Where the height the user dragged the sheet to is kept: a per-viewer convenience. */
const HEIGHT_KEY = 'of.mingo-sheet-height';

/** Per tab: the page a chat page collapses back to survives a reload, a new tab starts without one. */
const LAST_PAGE_KEY = 'of.mingo-last-page';

/** Per tab: the last page outside Mingo, where a phone's × in the top bar leaves Mingo for. */
const OUTSIDE_PAGE_KEY = 'of.mingo-outside-page';

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

function readPage(key: string): string | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writePage(key: string, href: string): void {
  try {
    window.sessionStorage.setItem(key, href);
  } catch {
    // Blocked storage: after a reload the way back is the default one.
  }
}

/** `trailingSlash: true` puts a slash after every path; compare without it. */
function trimSlash(pathname: string): string {
  return pathname.replace(/\/+$/, '') || '/';
}

/** The path a pending open was asked on (`askedFrom`). */
function currentPath(): string | null {
  return typeof window === 'undefined' ? null : trimSlash(window.location.pathname);
}

/**
 * The conversation sheet over a page in the Mingo-first shell (`MingoComposerSheet`):
 * the open chat, raised from the docked composer, with the page left beneath it.
 *
 * - `open` — the sheet is up. On any page but the chat page, which is the thread itself.
 * - `openAfterNavigation` — open on the page the next navigation lands on, once:
 *   a Getting Started chip opens its section and Mingo's answer there, and "Back to
 *   page" from the chat page. `askedFrom` is the path it was asked on: the
 *   sheet is up from the first frame of any other page (`isSheetUp`), so the page
 *   never shows undimmed before the sheet rises over it.
 * - `height` — what the user dragged it to; null = the sheet's default share.
 * - `node` — the sheet's body, published by the sheet for the dock to portal the
 *   chat's header and thread into (`EmbeddableChat.threadContainer`).
 * - `lastPage` — the last page other than the chat page this tab was on, with its
 *   query: where every chat page collapses back to ("Back to page"), the chat raised
 *   over it in the sheet; Mingo's home when there is none (a link opened in a new tab).
 *   Kept in `sessionStorage`, so a reload of the chat page still has its way back.
 * - `listOpen` — a phone's chat list over the page (the top bar's Mingo button): "Start
 *   New Chat", My / All Chats and the chats, as the classic drawer opened. Never with
 *   `open`; any navigation closes it.
 * - `listAfterNavigation` — open the list on the page the next navigation lands on, once,
 *   as `openAfterNavigation` does the sheet: "Back" from the new chat its "Start New
 *   Chat" opened. Up from that page's first frame (`isListUp`, the same `askedFrom`).
 * - `outsidePage` — the last page outside Mingo (not its home, a chat page or the
 *   sheet's routes' own), where a phone's × in the top bar leaves Mingo for. Kept in
 *   `sessionStorage` as `lastPage` is.
 */
interface MingoSheetStore {
  open: boolean;
  openAfterNavigation: boolean;
  askedFrom: string | null;
  height: number | null;
  node: HTMLElement | null;
  lastPage: string | null;
  listOpen: boolean;
  listAfterNavigation: boolean;
  outsidePage: string | null;
  show: () => void;
  hide: () => void;
  /** A phone's chat list over the page. */
  showList: () => void;
  hideList: () => void;
  /** A phone's chat list on the page the next navigation lands on. */
  showListAfterNavigation: () => void;
  showAfterNavigation: () => void;
  /**
   * The location changed: the sheet and the list close, unless one was asked to open
   * there. `listCanShow` is false on a page the list does not go over (Mingo's own).
   */
  navigated: (listCanShow?: boolean) => void;
  setHeight: (height: number) => void;
  /** Back to the default height (the resize tab's double click): the dragged one is forgotten. */
  resetHeight: () => void;
  setNode: (node: HTMLElement | null) => void;
  /** The sheet gives way to the chat's own page ("Open as full chat"). */
  openFull: () => void;
  /** A page other than the chat page is on screen: the one the chat page collapses back to. */
  rememberPage: (href: string) => void;
  /** A page outside Mingo is on screen: the one a phone's × leaves Mingo for. */
  rememberOutsidePage: (href: string) => void;
}

export const useMingoSheetStore = create<MingoSheetStore>()((set, get) => ({
  open: false,
  openAfterNavigation: false,
  askedFrom: null,
  height: readHeight(),
  node: null,
  lastPage: readPage(LAST_PAGE_KEY),
  listOpen: false,
  listAfterNavigation: false,
  outsidePage: readPage(OUTSIDE_PAGE_KEY),
  show: () =>
    set({ open: true, listOpen: false, openAfterNavigation: false, listAfterNavigation: false, askedFrom: null }),
  hide: () =>
    set({ open: false, listOpen: false, openAfterNavigation: false, listAfterNavigation: false, askedFrom: null }),
  showList: () =>
    set({ open: false, listOpen: true, openAfterNavigation: false, listAfterNavigation: false, askedFrom: null }),
  hideList: () => set({ listOpen: false, listAfterNavigation: false }),
  showListAfterNavigation: () =>
    set({
      open: false,
      listOpen: false,
      openAfterNavigation: false,
      listAfterNavigation: true,
      askedFrom: currentPath(),
    }),
  showAfterNavigation: () =>
    set({
      open: false,
      openAfterNavigation: true,
      listAfterNavigation: false,
      askedFrom: currentPath(),
    }),
  navigated: (listCanShow = true) =>
    set({
      open: get().openAfterNavigation,
      listOpen: get().listAfterNavigation && listCanShow,
      openAfterNavigation: false,
      listAfterNavigation: false,
      askedFrom: null,
    }),
  setHeight: height => {
    writeHeight(height);
    set({ height });
  },
  resetHeight: () => {
    forgetHeight();
    set({ height: null });
  },
  setNode: node => set({ node }),
  // `open` is left as it is: the sheet stays over the page until the chat page comes,
  // so the page does not show undimmed meanwhile.
  openFull: () => set({ openAfterNavigation: false, askedFrom: null }),
  rememberPage: href => {
    if (get().lastPage === href) return;
    writePage(LAST_PAGE_KEY, href);
    set({ lastPage: href });
  },
  rememberOutsidePage: href => {
    if (get().outsidePage === href) return;
    writePage(OUTSIDE_PAGE_KEY, href);
    set({ outsidePage: href });
  },
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

/**
 * Whether a phone's chat list is up on `pathname`: open, or asked to open on the page a
 * navigation lands on and this is a page other than the one it was asked on, as
 * `isSheetUp`. Pages the list does not go over are the caller's to rule out.
 */
export function isListUp(
  state: Pick<MingoSheetStore, 'listOpen' | 'listAfterNavigation' | 'askedFrom'>,
  pathname: string,
): boolean {
  if (state.listOpen) return true;
  return state.listAfterNavigation && state.askedFrom !== trimSlash(pathname);
}
