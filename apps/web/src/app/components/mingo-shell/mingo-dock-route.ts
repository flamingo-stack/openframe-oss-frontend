import { routes } from '@/lib/routes';

/**
 * Pages that need the whole content width (a remote screen, a terminal, the file
 * manager, the script editor): the dock drops its memory strip there. Path prefixes,
 * matched against the pathname, so they carry no query.
 */
const FULL_WIDTH_PATHS = [
  '/devices/details/remote-desktop',
  '/devices/details/remote-shell',
  '/devices/details/remote-session',
  '/devices/details/file-manager',
  '/scripts/new',
  '/scripts/edit',
] as const;

function isFullWidthPage(pathname: string): boolean {
  return FULL_WIDTH_PATHS.some(path => pathname.startsWith(path));
}

/**
 * Where the Mingo-first composer dock is, as far as the dock is concerned:
 *  - `home` — `/mingo`: always a new chat, no Compact.
 *  - `chat` — `/mingo/chat?id=`: the thread is the page (portalled into its node).
 *  - `full-width` — a remote screen, terminal, file manager or script editor: no
 *    memory strip, which takes height.
 *  - `page` — every other page: the composer under it, continuing the selected chat.
 * The model row is on every route: a composer that changed height from page to page
 * moved under the cursor.
 */
export type ComposerRoute = 'home' | 'chat' | 'full-width' | 'page';

/**
 * The chat page's path — `routes.mingo.chat(id)` without its query. A pathname
 * comparison, which ROUTES.md allows as a literal; the URL itself is always built
 * through `routes.mingo.chat`.
 */
const MINGO_CHAT_PATH = '/mingo/chat';

/** `trailingSlash: true` puts a slash after every path; compare without it. */
function withoutTrailingSlash(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
}

export function composerRouteOf(pathname: string | null): ComposerRoute {
  if (pathname === null) return 'page';
  const path = withoutTrailingSlash(pathname);
  if (path === routes.mingo.home) return 'home';
  if (path === MINGO_CHAT_PATH) return 'chat';
  if (isFullWidthPage(path)) return 'full-width';
  return 'page';
}

/**
 * Where the chat opens over the page (`MingoComposerSheet`) rather than taking it:
 * every page but Mingo's home (always a new chat) and the chat page (the thread itself).
 */
export function isSheetRoute(route: ComposerRoute): boolean {
  return route === 'page' || route === 'full-width';
}

/**
 * Where the sheet may be up: every sheet route, and home — "What to ask Mingo?" shows its
 * suggestions there in a chat not created yet, which has no chat page to go to (the pick
 * that creates it then follows it there), and a chat page collapses back to home when
 * it has no other page to go to. A send from home itself never opens it.
 */
export function canShowSheet(route: ComposerRoute): boolean {
  return isSheetRoute(route) || route === 'home';
}

/** How the dock draws itself on a route. */
export interface DockView {
  /** Max width, centred: the chat column in the chat, the page column elsewhere (FE_PROMPT §2.1). */
  widthClassName: string;
  placeholder: string;
  /** The context-memory strip — not on full-width pages (height). What is SENT is the same everywhere. */
  showContextMemory: boolean;
  /** Compact chat memory under the input — not on home: there is no chat to compact (PLAN §2.3). */
  showCompact: boolean;
  /**
   * The dock lies over the page's end (`AppLayout`'s `composerDockFloats`): the page runs
   * on under it and fades out. Not on the chat page (one surface with the thread) nor on
   * full-width pages (a remote screen or an editor must not lose its bottom edge).
   */
  floats: boolean;
}

const CHAT_WIDTH = 'max-w-[760px]';
const PAGE_WIDTH = 'max-w-[880px]';

/**
 * The sheet over a page: the composer card's width, not the dock column's. The chat
 * insets its composer by \`spacing-system-m\` on each side of the column, so the sheet
 * does the same (the column is \`PAGE_WIDTH\` at most): its edges meet the composer's
 * and the blocks above it (Getting Started), as the design's sheet holds its composer.
 */
export const SHEET_WIDTH_CLASS_NAME =
  'w-[calc(100%-2*var(--spacing-system-m))] max-w-[calc(880px-2*var(--spacing-system-m))]';

const DOCK_VIEWS: Record<ComposerRoute, DockView> = {
  home: {
    widthClassName: PAGE_WIDTH,
    placeholder: 'Ask Mingo or describe a task…',
    showContextMemory: true,
    showCompact: false,
    floats: true,
  },
  chat: {
    widthClassName: CHAT_WIDTH,
    placeholder: 'Reply to Mingo…',
    showContextMemory: true,
    showCompact: true,
    floats: false,
  },
  'full-width': {
    widthClassName: PAGE_WIDTH,
    placeholder: 'Ask Mingo about this page…',
    showContextMemory: false,
    showCompact: true,
    floats: false,
  },
  page: {
    widthClassName: PAGE_WIDTH,
    placeholder: 'Ask Mingo about this page…',
    showContextMemory: true,
    showCompact: true,
    floats: true,
  },
};

export function dockViewOf(route: ComposerRoute): DockView {
  return DOCK_VIEWS[route];
}
