import { routes } from '@/lib/routes';
import { isFullWidthPage } from '../mingo-side-panel';

/**
 * Where the Mingo-first composer dock is, as far as the dock is concerned:
 *  - `home` — `/mingo`: always a new chat, no model row, no composer ⋯.
 *  - `chat` — `/mingo/chat?id=`: the thread is the page (portalled into its node).
 *  - `full-width` — a remote screen, terminal, file manager or script editor: the
 *    composer at its minimum, the input row and nothing that takes height.
 *  - `page` — every other page: the composer under it, continuing the selected chat.
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

/** How the dock draws itself on a route. */
export interface DockView {
  /** Max width, centred: the chat column in the chat, the page column elsewhere (FE_PROMPT §2.1). */
  widthClassName: string;
  placeholder: string;
  /** The model + token row under the composer — not on home (no chat yet), not on full-width pages (height). */
  showModel: boolean;
  /** The context-memory strip — not on full-width pages (height). What is SENT is the same everywhere. */
  showContextMemory: boolean;
  /** The composer ⋯ (Compact Chat Memory) — not on home: there is no chat to compact (PLAN §2.3). */
  showComposerMenu: boolean;
}

const CHAT_WIDTH = 'max-w-[760px]';
const PAGE_WIDTH = 'max-w-[880px]';

const DOCK_VIEWS: Record<ComposerRoute, DockView> = {
  home: {
    widthClassName: PAGE_WIDTH,
    placeholder: 'Ask Mingo or describe a task…',
    showModel: false,
    showContextMemory: true,
    showComposerMenu: false,
  },
  chat: {
    widthClassName: CHAT_WIDTH,
    placeholder: 'Reply to Mingo…',
    showModel: true,
    showContextMemory: true,
    showComposerMenu: true,
  },
  'full-width': {
    widthClassName: PAGE_WIDTH,
    placeholder: 'Ask Mingo about this page…',
    showModel: false,
    showContextMemory: false,
    showComposerMenu: true,
  },
  page: {
    widthClassName: PAGE_WIDTH,
    placeholder: 'Ask Mingo about this page…',
    showModel: true,
    showContextMemory: true,
    showComposerMenu: true,
  },
};

export function dockViewOf(route: ComposerRoute): DockView {
  return DOCK_VIEWS[route];
}
