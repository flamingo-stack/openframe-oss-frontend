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
  /** Below the two rails + 800px (`ManhattanSqueeze.compact`): one column, the sidebars as drawers. */
  compact: boolean;
  setCompact: (compact: boolean) => void;
  /** Bumped when a chat opens in compact: the chats drawer it was picked from closes. */
  chatsDismiss: number;
  dismissChats: () => void;
  /**
   * The columns the work area actually shows (`AppLayout` `onWorkAreaShownModeChange`): `page`
   * where the row has no room for a split even though the centre asked for one. `null` until
   * it reports.
   */
  shownMode: AppLayoutWorkAreaMode | null;
  setShownMode: (mode: AppLayoutWorkAreaMode) => void;
  /** Start Work's "What to ask Mingo?" was answered in the chat column (a chat not created yet). */
  whatToAskInColumn: boolean;
  setWhatToAskInColumn: (open: boolean) => void;
  /**
   * Bumped when a link in the chat (a Mingo answer's entity link, a doc card) navigates in the
   * app: the page it leads to must be on screen, also when it is the page already behind the
   * chat (the URL does not change then).
   */
  linkedPageRequests: number;
  requestLinkedPage: () => void;
}

export const useManhattanCentreStore = create<ManhattanCentreStore>()(set => ({
  threadNode: null,
  setThreadNode: threadNode => set({ threadNode }),
  chatView: readChatView(),
  setChatView: chatView => {
    writeChatView(chatView);
    set({ chatView });
  },
  compact: false,
  setCompact: compact => set({ compact }),
  chatsDismiss: 0,
  dismissChats: () => set(state => ({ chatsDismiss: state.chatsDismiss + 1 })),
  shownMode: null,
  setShownMode: shownMode => set({ shownMode }),
  whatToAskInColumn: false,
  setWhatToAskInColumn: whatToAskInColumn => set({ whatToAskInColumn }),
  linkedPageRequests: 0,
  requestLinkedPage: () => set(state => ({ linkedPageRequests: state.linkedPageRequests + 1 })),
}));

/**
 * Which work-area columns show (plan D5, as changed by CU-17tkuw65znp: the chat is always
 * beside a page):
 * - Mingo's home (Start Work) and a chat's own page are pages: the page column alone, the
 *   composer docked under it (the chat page holds the thread);
 * - any other page, the full-height ones (remote desktop / shell, file manager) included:
 *   the chat column beside it (`split`) — the open chat, or Start Work when none is open —
 *   unless the user put the page full screen or closed the chat (`hidden` → the page alone,
 *   the composer under it), or put the chat full screen (`full` → the chat over the page,
 *   only while there is a chat to show);
 * - no chat for this session (the paywall): the page alone;
 * - `compact` (no room for two columns, plan D19, unchanged): the page alone with no open
 *   chat, else the chat over the page unless `hidden` (over a full-height page only `full`);
 * - `phone` (below md): the page alone, always — a chat there is its own page.
 */
export function workAreaModeOf(
  route: ComposerRoute,
  hasConversation: boolean,
  chatView: ManhattanChatView,
  compact = false,
  phone = false,
  chatEnabled = true,
): AppLayoutWorkAreaMode {
  if (phone || route === 'home' || route === 'chat' || !chatEnabled) return 'page';
  if (chatView === 'hidden') return 'page';
  if (compact) {
    // One column: the chat over the page, never over a full-height page unasked (as before).
    if (!hasConversation) return 'page';
    if (route === 'full-width') return chatView === 'full' ? 'chat' : 'page';
    return 'chat';
  }
  if (chatView === 'full' && hasConversation) return 'chat';
  return 'split';
}

/**
 * The columns on screen: the centre's `mode`, or the page alone where the work area had no
 * room for the split it was asked for (it reports that through `shownMode`). Chrome drawn
 * per column (the composer's place, the page header's actions) follows this.
 */
export function effectiveModeOf(
  mode: AppLayoutWorkAreaMode,
  shownMode: AppLayoutWorkAreaMode | null,
): AppLayoutWorkAreaMode {
  return shownMode === 'page' ? 'page' : mode;
}
