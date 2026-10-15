import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import type { DialogNode } from '../types';
import type { MingoDialogsPage } from './dialog-row-status';
import { mingoDialogQueryKeys } from './query-keys';

type DialogsData = InfiniteData<MingoDialogsPage, string | undefined>;

/** Who the new dialog belongs to: the signed-in admin. */
export interface NewDialogOwner {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  image?: { imageUrl?: string | null; hash?: string | null } | null;
}

/** How long a created dialog is held for a list the server has not caught up on. */
const HOLD_MS = 60_000;

/**
 * Dialogs created in this session that the server's list may not return yet:
 * right after `createDialog` a list read can still come back without the new
 * dialog for a few seconds. Each list read keeps them (`keepCreatedDialogs`)
 * until the server returns them, or the hold runs out.
 */
const createdDialogs = new Map<string, { node: DialogNode; at: number }>();

/**
 * Puts a dialog that was just created at the top of every cached chat list, so
 * it is listed (as "New Chat", until its title is generated) the moment it
 * exists. Without it the list only learned about the dialog from the refetch
 * after creation, and the open chat dropped out of the list for those seconds.
 * Later list reads keep it there until the server returns it (see
 * `keepCreatedDialogs`).
 *
 * Lists filtered by a search term are left alone: the new chat may not match
 * it. A list that already holds the dialog is left alone too.
 */
export function insertNewDialog(
  queryClient: QueryClient,
  dialogId: string,
  owner: NewDialogOwner | null,
  now = Date.now(),
): void {
  const node: DialogNode = {
    id: dialogId,
    dialogId,
    title: '',
    status: 'ACTIVE',
    streamState: 'IDLE',
    pendingApproval: null,
    createdAt: new Date(now).toISOString(),
    owner: owner
      ? {
          type: 'ADMIN',
          userId: owner.id,
          user: { id: owner.id, firstName: owner.firstName, lastName: owner.lastName, image: owner.image },
        }
      : undefined,
  };
  createdDialogs.set(dialogId, { node, at: now });

  for (const [queryKey, data] of queryClient.getQueriesData<DialogsData>({ queryKey: mingoDialogQueryKeys.lists })) {
    const params = queryKey[2] as { search?: string } | undefined;
    if (!data?.pages.length || params?.search) continue;
    if (data.pages.some(page => page.dialogs.some(dialog => dialog.dialogId === dialogId))) continue;
    const [first, ...rest] = data.pages;
    queryClient.setQueryData<DialogsData>(queryKey, {
      ...data,
      pages: [{ ...first, dialogs: [node, ...first.dialogs] }, ...rest],
    });
  }
}

/**
 * The first page of an unsearched list read, with the dialogs created in this
 * session that the server did not return yet put back on top. A dialog the
 * server returned (or whose hold ran out) is no longer held.
 */
export function keepCreatedDialogs(page: MingoDialogsPage, now = Date.now()): MingoDialogsPage {
  if (createdDialogs.size === 0) return page;
  const returned = new Set(page.dialogs.map(dialog => dialog.dialogId));
  const missing: DialogNode[] = [];
  for (const [dialogId, { node, at }] of createdDialogs) {
    if (returned.has(dialogId) || now - at > HOLD_MS) createdDialogs.delete(dialogId);
    else missing.push(node);
  }
  return missing.length > 0 ? { ...page, dialogs: [...missing.reverse(), ...page.dialogs] } : page;
}

/** Drops every held dialog (tests; a signed-out session). */
export function forgetCreatedDialogs(): void {
  createdDialogs.clear();
}
