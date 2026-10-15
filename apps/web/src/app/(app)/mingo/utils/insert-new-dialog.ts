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

/**
 * Puts a dialog that was just created at the top of every cached chat list, so
 * it is listed (as "New Chat", until its title is generated) the moment it
 * exists. Without it the list only learned about the dialog from the refetch
 * after creation, and the open chat dropped out of the list for those seconds.
 * The refetch then replaces the row with the server's.
 *
 * Lists filtered by a search term are left alone: the new chat may not match
 * it. A list that already holds the dialog is left alone too.
 */
export function insertNewDialog(queryClient: QueryClient, dialogId: string, owner: NewDialogOwner | null): void {
  const node: DialogNode = {
    id: dialogId,
    dialogId,
    title: '',
    status: 'ACTIVE',
    streamState: 'IDLE',
    pendingApproval: null,
    createdAt: new Date().toISOString(),
    owner: owner
      ? {
          type: 'ADMIN',
          userId: owner.id,
          user: { id: owner.id, firstName: owner.firstName, lastName: owner.lastName, image: owner.image },
        }
      : undefined,
  };

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
