'use client';

import { ComposerSheet } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { useMdUp } from '@flamingo-stack/openframe-frontend-core/hooks';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { useMingoChatThreadOnScreen } from '@/app/(app)/mingo/providers/mingo-chat-provider';
import { useNativeBackDismissible } from '@/lib/native-back';
import { composerRouteOf, dockViewOf, isSheetRoute } from './mingo-dock-route';
import { useMingoSheetStore } from './mingo-sheet-store';

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
 * and the chat page is the thread itself. Full width on a phone, the composer's
 * width elsewhere.
 */
export function MingoComposerSheet() {
  const pathname = usePathname();
  const route = composerRouteOf(pathname);
  const open = useMingoSheetStore(s => s.open);
  const height = useMingoSheetStore(s => s.height);
  const hide = useMingoSheetStore(s => s.hide);
  const setHeight = useMingoSheetStore(s => s.setHeight);
  const setNode = useMingoSheetStore(s => s.setNode);
  const navigated = useMingoSheetStore(s => s.navigated);
  const clearFullFrom = useMingoSheetStore(s => s.clearFullFrom);
  const phone = useMdUp() === false;
  const shown = open && isSheetRoute(route);

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
      height={height}
      onHeightChange={setHeight}
      defaultShare={phone ? 0.88 : 0.64}
      className={phone ? undefined : dockViewOf(route).widthClassName}
      aria-label="Mingo chat"
    >
      <div ref={setNode} className="flex min-h-0 flex-1 flex-col" />
      {shown && <SheetThreadOnScreen />}
    </ComposerSheet>
  );
}
