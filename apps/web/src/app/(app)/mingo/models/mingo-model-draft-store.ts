import { create } from 'zustand';
import { getQueryClient } from '@/lib/query-client';
import { type DialogModel, dialogModelQueryKey } from './dialog-model-api';

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

/** Shows the model sent at creation until the first read and consumes that draft if it is still current. */
export function adoptDraftModel(dialogId: string, draft: DialogModel): void {
  const queryClient = getQueryClient();
  queryClient.setQueryData(dialogModelQueryKey(dialogId), {
    model: draft,
    effectiveModel: draft,
    modelTokenBudget: null,
  });
  void queryClient.invalidateQueries({ queryKey: dialogModelQueryKey(dialogId) });
  const { draft: currentDraft, setDraft } = useMingoModelDraftStore.getState();
  if (currentDraft === draft) setDraft(null);
}
