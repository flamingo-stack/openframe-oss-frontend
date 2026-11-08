'use client';

import type { AppLayoutWorkAreaMode } from '@flamingo-stack/openframe-frontend-core/components/navigation';
import { create } from 'zustand';
import type { ComposerRoute } from '@/app/components/mingo-shell/mingo-dock-route';

/**
 * How the open chat sits beside a page in the Manhattan v2 centre (plan D5, table T):
 * - `split`: the chat column beside the page column (where a chat opens);
 * - `full`: the chat takes the centre, the page is hidden behind it ("chat full screen");
 * - `hidden`: the page takes the centre, the chat waits behind it ("page full screen").
 * Per tab (`sessionStorage`): a reload keeps it, a new tab starts at `split`.
 */
export type ManhattanChatView = 'split' | 'full' | 'hidden';

const CHAT_VIEW_KEY = 'of.manhattan.chatView';

function readChatView(): ManhattanChatView {
  if (typeof window === 'undefined') return 'split';
  try {
    const stored = window.sessionStorage.getItem(CHAT_VIEW_KEY);
    return stored === 'full' || stored === 'hidden' ? stored : 'split';
  } catch {
    return 'split';
  }
}

function writeChatView(view: ManhattanChatView): void {
  try {
    window.sessionStorage.setItem(CHAT_VIEW_KEY, view);
  } catch {
    // Storage refused: the view holds for this page's life only.
  }
}

interface ManhattanCentreStore {
  /** The chat column's thread node: the session's `EmbeddableChat` portals its header and thread into it. */
  threadNode: HTMLElement | null;
  setThreadNode: (node: HTMLElement | null) => void;
  chatView: ManhattanChatView;
  setChatView: (view: ManhattanChatView) => void;
}

export const useManhattanCentreStore = create<ManhattanCentreStore>()(set => ({
  threadNode: null,
  setThreadNode: threadNode => set({ threadNode }),
  chatView: readChatView(),
  setChatView: chatView => {
    writeChatView(chatView);
    set({ chatView });
  },
}));

/**
 * Which work-area columns show (plan D5):
 * - Mingo's home (Start Work) and a chat's own page are pages: the page column alone,
 *   the composer docked under it, as on the Mingo-first shell (the chat page holds the thread);
 * - any other page: the open chat beside it (`split`), over it (`full`) or behind it
 *   (`hidden` → the page alone); with no open chat, the page alone;
 * - a full-height page (remote desktop / shell, file manager) never shares the centre
 *   (plan D9): the page alone, or the chat over it.
 */
export function workAreaModeOf(
  route: ComposerRoute,
  hasOpenChat: boolean,
  chatView: ManhattanChatView,
): AppLayoutWorkAreaMode {
  if (route === 'home' || route === 'chat') return 'page';
  if (!hasOpenChat || chatView === 'hidden') return 'page';
  if (chatView === 'full') return 'chat';
  return route === 'full-width' ? 'page' : 'split';
}

/** The view that brings the open chat on screen on `route`: beside the page, or over a full-height one. */
export function shownChatViewOf(route: ComposerRoute): ManhattanChatView {
  return route === 'full-width' ? 'full' : 'split';
}
