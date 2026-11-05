'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { routes } from '@/lib/routes';
import type { MingoChatState } from '../providers/mingo-chat-provider';

/**
 * What the chat page shows for its `?id`:
 * - `starting`: the session's state is not running yet, or the selection has not
 *   reached this dialog yet;
 * - `ready`: this dialog is the selected one — the docked chat shows it;
 * - `not-found`: the id names nothing this user can open (deleted, someone else's,
 *   mistyped). Settled: the session has already dropped the selection;
 * - `failed`: the dialog could not be loaded; the selection is kept for a retry.
 */
export type ChatPageStatus = 'starting' | 'ready' | 'not-found' | 'failed';

/** What the chat page shows, and how it asks for its dialog again after `failed`. */
export interface ChatPageSelection {
  status: ChatPageStatus;
  /** Read the dialog again: the selection is dropped and taken back, which the engine reads as entering it anew. */
  retry: () => void;
}

/**
 * The Mingo-first chat page's half of the selection: `?id` → the session's selected
 * dialog, and back to the page when the selection moves on.
 *
 * - **URL → selection, once per id.** The page is the only writer of the selection
 *   from the URL, and it writes it when an id arrives (mount, or another `?id`) —
 *   never again for the same id, so it does not fight the dock.
 * - **Selection → page, once it has landed.** After this dialog was selected, the
 *   selection moving is followed instead of undone: dropped to none (the open chat
 *   was archived — from its header or the sidebar — or a new chat was started) goes
 *   to Mingo home; another dialog (a chat the composer just created) becomes the
 *   page's `?id`. Until it has landed, a different selection is only the one from
 *   before this page.
 * - **Not found** is latched while rendering: the session toasts it and drops the
 *   selection right after, so the error is visible for a single state.
 * - **No id** (`null`, "What to ask Mingo?"): a chat not created yet. Nothing is written
 *   (the dock opens the new chat); it has landed once nothing is selected, and the chat
 *   a pick creates then becomes the page's `?id`.
 * - **Retry** drops the selection and takes it back once that has landed, which reads
 *   the dialog afresh; the drop in between is not a selection moving on.
 */
export function useChatPageSelection(dialogId: string | null, chat: MingoChatState | null): ChatPageSelection {
  const router = useRouter();
  const selectDialog = chat?.state.selectDialog;
  // `undefined`: no running state to read a selection from.
  const activeDialogId = chat ? chat.state.activeDialogId : undefined;
  const dialogError = chat?.state.dialogError ?? null;
  const dialogNotFound = chat?.dialogNotFound ?? false;

  const [notFoundId, setNotFoundId] = useState<string | null>(null);
  if (dialogId !== null && dialogNotFound && activeDialogId === dialogId && notFoundId !== dialogId) {
    setNotFoundId(dialogId);
  }
  const notFound = dialogId !== null && notFoundId === dialogId;

  const appliedIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (dialogId === null || !selectDialog || appliedIdRef.current === dialogId) return;
    appliedIdRef.current = dialogId;
    selectDialog(dialogId);
  }, [dialogId, selectDialog]);

  // The dialog a retry dropped, until it is selected again; and whether it was asked for again yet.
  const retryRef = useRef<{ dialogId: string; reselected: boolean } | null>(null);
  const retry = () => {
    if (dialogId === null || !selectDialog) return;
    retryRef.current = { dialogId, reselected: false };
    selectDialog(null);
  };

  // `undefined`: nothing has landed yet (`null` is the new chat's landing).
  const landedIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (activeDialogId === undefined) return;
    const retrying = retryRef.current?.dialogId === dialogId ? retryRef.current : null;
    if (activeDialogId === dialogId) {
      landedIdRef.current = dialogId;
      // Still selected: the retry's drop has not landed yet. Taken back: the retry is done.
      if (retrying?.reselected) retryRef.current = null;
      return;
    }
    if (retrying && activeDialogId === null) {
      if (!retrying.reselected) {
        retrying.reselected = true;
        selectDialog?.(dialogId);
      }
      return;
    }
    if (landedIdRef.current !== dialogId) return;
    if (activeDialogId !== null) router.replace(routes.mingo.chat(activeDialogId));
    else if (!notFound) router.replace(routes.mingo.home);
  }, [activeDialogId, dialogId, notFound, router, selectDialog]);

  if (notFound) return { status: 'not-found', retry };
  if (activeDialogId !== dialogId) return { status: 'starting', retry };
  return { status: dialogError && dialogId !== null ? 'failed' : 'ready', retry };
}
