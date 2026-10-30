'use client';

import type { UnifiedChatState } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { useEffect, useRef } from 'react';
import { type ComposerRoute, isSheetRoute } from './mingo-dock-route';

/** Per tab: a reload keeps the chat, a new tab starts without one. */
const STORAGE_KEY = 'of.mingo-chat-behind-page';

function readChatId(): string | null {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeChatId(id: string | null): void {
  try {
    if (id === null) window.sessionStorage.removeItem(STORAGE_KEY);
    else window.sessionStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Blocked storage: a reload simply starts without the chat, as before.
  }
}

/**
 * Keeps the chat open behind the pages — the one their "Continue" chip and the sheet
 * show — across a reload of this tab. The selection is the session's and lives in
 * memory, so a reload used to drop it with the chip; now the open chat is written to
 * `sessionStorage` on every change and selected again once the dialog list has
 * loaded, on a page that shows a chat behind it (not on home, which is always a new
 * chat, nor on the chat page, which selects its own `?id=`). Only a chat the list
 * still has comes back: an archived or deleted one is forgotten. Restored once per
 * mount; the sheet itself stays closed.
 */
export function useChatBehindPage({ route, state }: { route: ComposerRoute; state: UnifiedChatState }): void {
  const { activeDialogId, dialogs, isDialogsLoading, selectDialog } = state;
  const restoredRef = useRef(false);

  useEffect(() => {
    if (restoredRef.current || isDialogsLoading) return;
    restoredRef.current = true;
    if (activeDialogId === null && isSheetRoute(route)) {
      const id = readChatId();
      if (id !== null && dialogs.some(dialog => dialog.id === id)) {
        selectDialog(id);
        return;
      }
    }
    // Nothing to bring back: what is open now is what the tab keeps — a chat page
    // selects its `?id=` before the list has loaded, past the writer below.
    writeChatId(activeDialogId ?? null);
  }, [isDialogsLoading, activeDialogId, route, dialogs, selectDialog]);

  // Written only past the restore pass, so the empty selection of a fresh load does
  // not erase the chat before it has been read back.
  useEffect(() => {
    if (restoredRef.current) writeChatId(activeDialogId ?? null);
  }, [activeDialogId]);
}
