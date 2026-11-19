import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAdminAiConfig } from '@/app/(app)/settings/ai-settings/hooks/use-agent-ai-config';
import {
  type SupportedModelsByProvider,
  useSupportedModels,
} from '@/app/(app)/settings/ai-settings/hooks/use-supported-models';
import { LLM_PROVIDER_OPTIONS } from '@/app/(app)/settings/ai-settings/utils/ai-settings-display';
import { useFeatureFlagGate } from '@/app/hooks/use-feature-flag';
import type { AIProvider } from '@/generated/schema-enums';
import type { FeatureFlagGate } from '@/lib/feature-flags';
import {
  type DialogModel,
  type DialogModelChoice,
  dialogModelQueryKey,
  fetchDialogModel,
  updateDialogModel,
} from './dialog-model-api';
import { useMingoModelDraftStore } from './mingo-model-draft-store';

export const MINGO_MODEL_FLAG = 'ai-mingo-chat-model-selection';

/** What of the chat decides whether its model can change now. */
export interface MingoModelChatState {
  activeDialogId: string | null;
  streamingPhase: string;
  archived: boolean;
  isCompacting: boolean;
}

export interface MingoModelSelection {
  gate: FeatureFlagGate;
  /** The model that answers this chat (a new chat: the draft's pick); null = the chat's own label stands. */
  current: DialogModel | null;
  /** The answering model's context, once the server said. */
  contextSize: number | null;
  picker: MingoModelPickerState | null;
}

export interface MingoModelPickerState {
  disabled: boolean;
  followsDefault: boolean;
  chooseDefault: () => void;
  providers: {
    provider: AIProvider;
    current: boolean;
    models: { id: string; label: string; current: boolean; choose: () => void }[];
  }[];
}

/** The model for one Mingo chat: read from the chat, picked from its composer; a new chat keeps its pick in a draft. */
export function useMingoModelSelection(chat: MingoModelChatState): MingoModelSelection {
  const gate = useFeatureFlagGate(MINGO_MODEL_FLAG);
  const enabled = gate === 'on';
  const { activeDialogId } = chat;
  const { modelsByProvider } = useSupportedModels();
  const { config } = useAdminAiConfig();
  const draft = useMingoModelDraftStore(s => s.draft);
  const setDraft = useMingoModelDraftStore(s => s.setDraft);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: dialogModelQueryKey(activeDialogId ?? ''),
    queryFn: () => fetchDialogModel(activeDialogId ?? ''),
    enabled: enabled && activeDialogId !== null,
  });
  const mutation = useMutation({
    mutationFn: ({ dialogId, model }: { dialogId: string; model: DialogModelChoice | null }) =>
      updateDialogModel(dialogId, model),
    onSuccess: (state, { dialogId }) => queryClient.setQueryData(dialogModelQueryKey(dialogId), state),
    onError: error =>
      toast({
        title: 'Could not change chat model',
        description: error instanceof Error ? error.message : 'Please try again',
        variant: 'destructive',
      }),
  });

  if (!enabled) return { gate, current: null, contextSize: null, picker: null };

  const saved = activeDialogId ? query.data : undefined;
  const selected = activeDialogId ? (saved?.model ?? null) : draft;
  const current = activeDialogId ? (saved?.effectiveModel ?? null) : draft;
  const effectiveProvider = current?.provider ?? config?.llmProvider;
  const effectiveModelName = current?.modelName ?? config?.providerModel;
  const locked =
    mutation.isPending ||
    (activeDialogId !== null && query.isPending) ||
    chat.streamingPhase !== 'idle' ||
    chat.archived ||
    chat.isCompacting;

  const choose = (model: DialogModel | null) => {
    if (activeDialogId) mutation.mutate({ dialogId: activeDialogId, model });
    else setDraft(model);
  };

  return {
    gate,
    current: current && { ...current, displayName: labelOf(current, modelsByProvider) },
    contextSize: saved?.modelTokenBudget ?? null,
    picker: {
      disabled: locked,
      followsDefault: selected === null,
      chooseDefault: () => choose(null),
      providers: LLM_PROVIDER_OPTIONS.flatMap(provider => {
        const options = modelsByProvider?.[provider] ?? [];
        if (options.length === 0) return [];
        return {
          provider,
          current: provider === effectiveProvider,
          models: options.map(option => {
            const model = { provider, modelName: option.value, displayName: option.label };
            return {
              id: option.value,
              label: option.label,
              current: provider === effectiveProvider && option.value === effectiveModelName,
              choose: () => choose(model),
            };
          }),
        };
      }),
    },
  };
}

function labelOf(model: DialogModel, modelsByProvider: SupportedModelsByProvider | undefined): string {
  return (
    model.displayName ??
    modelsByProvider?.[model.provider]?.find(option => option.value === model.modelName)?.label ??
    model.modelName
  );
}
