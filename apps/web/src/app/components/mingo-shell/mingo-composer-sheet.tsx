'use client';

import { ComposerSheet } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { useMdUp } from '@flamingo-stack/openframe-frontend-core/hooks';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { useMingoChatThreadOnScreen } from '@/app/(app)/mingo/providers/mingo-chat-provider';
import { useNativeBackDismissible } from '@/lib/native-back';
import { canShowSheet, composerRouteOf, SHEET_WIDTH_CLASS_NAME } from './mingo-dock-route';
import { isSheetUp, useMingoSheetStore } from './mingo-sheet-store';

/**
 * Where the sheet opens on a desktop until the user drags it elsewhere: tall enough for a
 * few turns of the chat, short enough to leave the page's top in view. Clamped to the room
 * there is. A phone opens it at a share of the screen instead.
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
 * "Continue" brings it back. Only on plain pages: Mingo's home is always a new chat
 * and the chat page is the thread itself. Full width on a phone, the composer card's
 * width elsewhere (its edges meet the composer's); `SHEET_DEFAULT_HEIGHT` tall on a desktop until dragged, the
 * dragged height after that.
 */
export function MingoComposerSheet() {
  const pathname = usePathname();
  const route = composerRouteOf(pathname);
  // Up on the first frame of a page it was asked to open on, not only once `navigated` ran.
  const up = useMingoSheetStore(s => isSheetUp(s, pathname));
  const height = useMingoSheetStore(s => s.height);
  const hide = useMingoSheetStore(s => s.hide);
  const setHeight = useMingoSheetStore(s => s.setHeight);
  const resetHeight = useMingoSheetStore(s => s.resetHeight);
  const setNode = useMingoSheetStore(s => s.setNode);
  const navigated = useMingoSheetStore(s => s.navigated);
  const clearFullFrom = useMingoSheetStore(s => s.clearFullFrom);
  const phone = useMdUp() === false;
  const shown = up && canShowSheet(route);

  // Every location change closes it, or opens it there when that was asked for. The
  // way back from a chat opened in full lasts only while the chat page is on screen.
  useEffect(() => {
    navigated();
    if (route !== 'chat') clearFullFrom();
  }, [pathname, route, navigated, clearFullFrom]);

  useNativeBackDismissible(shown, hide);

  useEffect(() => {
    if (!shown) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || escapeIsTaken()) return;
      hide();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [shown, hide]);

  return (
    <ComposerSheet
      open={shown}
      onDismiss={hide}
      height={height ?? (phone ? null : SHEET_DEFAULT_HEIGHT)}
      onHeightChange={setHeight}
      onResetHeight={resetHeight}
      defaultShare={0.88}
      className={phone ? undefined : SHEET_WIDTH_CLASS_NAME}
      aria-label="Mingo chat"
    >
      <div ref={setNode} className="flex min-h-0 flex-1 flex-col" />
      {shown && <SheetThreadOnScreen />}
    </ComposerSheet>
  );
}
