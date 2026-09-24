export const mingoDialogsKey = (filters: { search?: string; limit?: number; scope?: string } = {}) =>
  ['mingo-dialogs', filters] as const;

export const mingoDialogsBaseKey = ['mingo-dialogs'] as const;
