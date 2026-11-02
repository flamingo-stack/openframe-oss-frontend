/**
 * Query keys for the chat list and the single-dialog caches. One definition, shared by
 * the hook that owns the queries and by everything that writes to or invalidates them.
 * The list sits under `['mingo-dialogs']`, which the incident dialogs share, so code
 * that writes the list's pages matches `lists`, not the bare prefix.
 */
export const mingoDialogQueryKeys = {
  lists: ['mingo-dialogs', 'list'] as const,
  list: (params: { search?: string; limit: number; scope: string }) => ['mingo-dialogs', 'list', params] as const,
  detail: (dialogId: string | null) => ['mingo-dialog', dialogId] as const,
  messages: (dialogId: string | null) => ['mingo-dialog-messages', dialogId] as const,
};
