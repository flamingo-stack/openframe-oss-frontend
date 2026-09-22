/**
 * Query keys for the single-dialog caches. One definition, shared by the hook that
 * owns the queries and by everything that writes to or invalidates them.
 */
export const mingoDialogQueryKeys = {
  detail: (dialogId: string | null) => ['mingo-dialog', dialogId] as const,
  messages: (dialogId: string | null) => ['mingo-dialog-messages', dialogId] as const,
};
