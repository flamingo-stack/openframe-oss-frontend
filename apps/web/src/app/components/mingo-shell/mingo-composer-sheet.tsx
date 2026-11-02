'use client';

import { ComposerSheet } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { useMdUp } from '@flamingo-stack/openframe-frontend-core/hooks';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { useMingoChatThreadOnScreen } from '@/app/(app)/mingo/providers/mingo-chat-provider';
import { useNativeBackDismissible } from '@/lib/native-back';
import { canShowSheet, composerRouteOf, isSheetRoute, SHEET_WIDTH_CLASS_NAME } from './mingo-dock-route';
import { MingoPhoneChatList } from './mingo-phone-chat-list';
import { isListUp, isSheetUp, useMingoSheetStore } from './mingo-sheet-store';

/**
 * Where the sheet opens on a desktop until the user drags it elsewhere: tall enough for a
 * few turns of the chat, short enough to leave the page's top in view. Clamped to the room
 * there is. A phone gives it the whole screen instead.
 */
export const SHEET_DEFAULT_HEIGHT = 500;

/** Says the chat's thread is on screen while the sheet is up: its notifications skip the popup. */
function SheetThreadOnScreen() {
  useMingoChatThreadOnScreen();
  return null;
}

/**
 * Whether Esc belongs to something inside the sheet's reach rather than to the sheet:
 * an open menu or popover (they close on it themselves), or a draft in the composer.
 */
function escapeIsTaken(): boolean {
  if (document.querySelector('[data-radix-popper-content-wrapper]')) return true;
  const editor = document.activeElement?.closest('[data-editor]');
  return !!editor?.textContent?.trim();
}

/**
 * The open chat over the page it was asked from (`AppLayout`'s `composerSheet`
 * layer): a message sent from a page opens it there instead of leaving the page for
 * the chat, and closing it puts the chat back behind the composer's "Continue" chip.
 * The sheet's body is the node the dock portals the chat's header and thread into
 * (`useMingoSheetStore.node`).
 *
 * It closes with its ×, the scrim, Esc (unless a menu or a draft takes it) and
 * Android back, and on any navigation — the next page is a different context;
 * "Continue" brings it back. On every page but the chat page, which is the thread
 * itself: over Mingo's home only for a chat collapsed back from its page. It also tells
 * the store which page the chat page collapses back to (`lastPage`), and the last page
 * outside Mingo (`outsidePage`). On a phone it takes the screen, the whole layer and no
 * resize tab, and holds the chat list (`listOpen`, the top bar's Mingo button: a chat
 * there opens on its page, as every chat does on a phone). Elsewhere the composer
 * card's width (its edges meet the composer's), `SHEET_DEFAULT_HEIGHT` tall until
 * dragged, the dragged height after that.
 */
export function MingoComposerSheet() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const route = composerRouteOf(pathname);
  // Up on the first frame of a page it was asked to open on, not only once `navigated` ran.
  const up = useMingoSheetStore(s => isSheetUp(s, pathname));
  const height = useMingoSheetStore(s => s.height);
  const hide = useMingoSheetStore(s => s.hide);
  const setHeight = useMingoSheetStore(s => s.setHeight);
  const resetHeight = useMingoSheetStore(s => s.resetHeight);
  const setNode = useMingoSheetStore(s => s.setNode);
  const navigated = useMingoSheetStore(s => s.navigated);
  const rememberPage = useMingoSheetStore(s => s.rememberPage);
  const rememberOutsidePage = useMingoSheetStore(s => s.rememberOutsidePage);
  const phone = useMdUp() === false;
  const shown = up && canShowSheet(route);
  // A phone's chat list, over a page (not Mingo's own); the chat itself is never in it at
  // once (`showList`). Up on the first frame of a page it was asked to open on, as the sheet.
  const listShown = useMingoSheetStore(s => isListUp(s, pathname)) && phone && !shown && isSheetRoute(route);
  const hideList = useMingoSheetStore(s => s.hideList);
  const dismiss = listShown ? hideList : hide;

  // Every location change closes it, or opens it there when that was asked for. A
  // query change on the same page is not one: filters do not close the chat.
  useEffect(() => {
    navigated(isSheetRoute(route));
  }, [pathname, route, navigated]);

  // The page a chat page collapses back to: the last one on screen, with its query.
  useEffect(() => {
    const href = search ? `${pathname}?${search}` : pathname;
    if (route !== 'chat') rememberPage(href);
    if (isSheetRoute(route)) rememberOutsidePage(href);
  }, [pathname, search, route, rememberPage, rememberOutsidePage]);

  useNativeBackDismissible(shown || listShown, dismiss);

  useEffect(() => {
    if (!shown && !listShown) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || escapeIsTaken()) return;
      dismiss();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [shown, listShown, dismiss]);

  return (
    <ComposerSheet
      open={shown || listShown}
      onDismiss={dismiss}
      height={phone ? null : (height ?? SHEET_DEFAULT_HEIGHT)}
      onHeightChange={setHeight}
      onResetHeight={resetHeight}
      defaultShare={1}
      resizable={!phone}
      className={phone ? undefined : SHEET_WIDTH_CLASS_NAME}
      aria-label="Mingo chat"
    >
      {listShown ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <MingoPhoneChatList />
        </div>
      ) : (
        <div ref={setNode} className="flex min-h-0 flex-1 flex-col" />
      )}
      {shown && <SheetThreadOnScreen />}
    </ComposerSheet>
  );
}
