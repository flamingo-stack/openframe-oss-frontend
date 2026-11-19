import { create } from 'zustand';
import { getQueryClient } from '@/lib/query-client';
import { type DialogModel, type DialogModelChoice, dialogModelQueryKey } from './dialog-model-api';

/**
 * The model picked for the chat that does not exist yet (a new chat's composer). A store, not chat state: the dialog
 * is created inside the chat engine's history backend, which reads the pick at that moment.
 */
interface MingoModelDraftState {
  draft: DialogModel | null;
  setDraft: (draft: DialogModel | null) => void;
}

export const useMingoModelDraftStore = create<MingoModelDraftState>()(set => ({
  draft: null,
  setDraft: draft => set({ draft }),
}));

/** The draft's pick for `createDialog`, or null for the tenant default. */
export function draftModelChoice(): DialogModelChoice | null {
  const { draft } = useMingoModelDraftStore.getState();
  return draft && { provider: draft.provider, modelName: draft.modelName };
}

/**
 * The chat was created on the draft's pick: its label holds the pick while the first read is in flight, and the next
 * new chat starts on the default again.
 */
export function adoptDraftModel(dialogId: string): void {
  const { draft, setDraft } = useMingoModelDraftStore.getState();
  if (!draft) return;
  const queryClient = getQueryClient();
  queryClient.setQueryData(dialogModelQueryKey(dialogId), {
    model: draft,
    effectiveModel: draft,
    modelTokenBudget: null,
  });
  void queryClient.invalidateQueries({ queryKey: dialogModelQueryKey(dialogId) });
  setDraft(null);
}
