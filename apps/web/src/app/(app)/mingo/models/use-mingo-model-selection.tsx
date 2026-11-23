import { NamedIcon } from '@flamingo-stack/openframe-frontend-core/components';
import type { ModelMenu } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { showToast } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type SupportedModelsByProvider,
  useSupportedModels,
} from '@/app/(app)/settings/ai-settings/hooks/use-supported-models';
import {
  LLM_PROVIDER_ICON,
  LLM_PROVIDER_LABEL,
  LLM_PROVIDER_OPTIONS,
} from '@/app/(app)/settings/ai-settings/utils/ai-settings-display';
import { type AiModel, useAiModelStatus } from '@/app/hooks/use-ai-model';
import { useFeatureFlagGate } from '@/app/hooks/use-feature-flag';
import type { FeatureFlagGate } from '@/lib/feature-flags';
import {
  type DialogModel,
  type DialogModelChoice,
  dialogModelQueryKey,
  fetchDialogModel,
  updateDialogModel,
} from './dialog-model-api';
import styles from './mingo-model-change-toast.module.css';
import {
  comparisonDescription,
  comparisonOptions,
  comparisonPrices,
  ModelComparisonFooter,
  ModelComparisonRow,
} from './mingo-model-comparison';
import { useMingoModelDraftStore } from './mingo-model-draft-store';
import { useMingoModelPricing } from './use-mingo-model-pricing';

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
  /** The composer's model menu; null while the flag is not on. */
  menu: ModelMenu | null;
}

type ModelIdentity = Pick<AiModel, 'provider' | 'modelName'>;

function isSameModel(previous: ModelIdentity | null, next: ModelIdentity) {
  return previous !== null && previous.provider === next.provider && previous.modelName === next.modelName;
}

/** The model for one Mingo chat: read from the chat, picked from its composer; a new chat keeps its pick in a draft. */
export function useMingoModelSelection(chat: MingoModelChatState): MingoModelSelection {
  const gate = useFeatureFlagGate(MINGO_MODEL_FLAG);
  const enabled = gate === 'on';
  const { activeDialogId } = chat;
  const { modelsByProvider } = useSupportedModels();
  const { aiModel } = useAiModelStatus();
  const pricing = useMingoModelPricing(enabled);
  const draft = useMingoModelDraftStore(s => s.draft);
  const setDraft = useMingoModelDraftStore(s => s.setDraft);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const showChange = (label: string) =>
    showToast({
      title: 'Chat model changed',
      description: `${label} answers from your next message. Your other chats keep their model.`,
      variant: 'success',
      className: styles.modelChangeToast,
    });

  const query = useQuery({
    queryKey: dialogModelQueryKey(activeDialogId ?? ''),
    queryFn: () => fetchDialogModel(activeDialogId ?? ''),
    enabled: enabled && activeDialogId !== null,
  });
  const mutation = useMutation({
    mutationFn: ({
      dialogId,
      model,
    }: {
      dialogId: string;
      model: DialogModelChoice | null;
      previousModel: ModelIdentity | null;
    }) => updateDialogModel(dialogId, model),
    onSuccess: (state, { dialogId, previousModel }) => {
      queryClient.setQueryData(dialogModelQueryKey(dialogId), state);
      if (!isSameModel(previousModel, state.effectiveModel))
        showChange(labelOf(state.effectiveModel, modelsByProvider));
    },
    onError: error =>
      toast({
        title: 'Could not change chat model',
        description: error instanceof Error ? error.message : 'Please try again',
        variant: 'destructive',
      }),
  });

  if (!enabled) return { gate, current: null, contextSize: null, menu: null };

  const saved = activeDialogId ? query.data : undefined;
  const selected = activeDialogId ? (saved?.model ?? null) : draft;
  const current = activeDialogId ? (saved?.effectiveModel ?? null) : draft;
  // The tenant default fills a new chat only. A saved chat uses its own server-resolved model.
  const answering = activeDialogId === null ? (current ?? aiModel ?? null) : current;
  const selectionKnown = activeDialogId === null || saved !== undefined;
  const followsDefault = selectionKnown && selected === null;
  const locked =
    mutation.isPending ||
    (activeDialogId !== null && query.isPending) ||
    chat.streamingPhase !== 'idle' ||
    chat.archived ||
    chat.isCompacting;

  const choose = (model: DialogModel | null) => {
    if (locked || (model ? selectionKnown && isSameModel(answering, model) : followsDefault)) return;
    if (activeDialogId) {
      mutation.mutate({ dialogId: activeDialogId, model, previousModel: answering });
      return;
    }
    setDraft(model);
    const next = model ?? aiModel;
    if (next && !isSameModel(answering, next)) {
      showChange(model ? labelOf(model, modelsByProvider) : (aiModel?.displayName ?? next.modelName));
    }
  };

  return {
    gate,
    current: current && { ...current, displayName: labelOf(current, modelsByProvider) },
    contextSize: saved?.modelTokenBudget ?? null,
    menu: {
      disabled: locked,
      mobileDrillDown: true,
      groups: [
        {
          separator: true,
          items: [
            {
              id: 'chat-model-default',
              label: followsDefault ? 'Using default model' : 'Use default model',
              disabled: followsDefault,
              onClick: () => choose(null),
            },
          ],
        },
        {
          items: LLM_PROVIDER_OPTIONS.flatMap(provider => {
            const options = modelsByProvider?.[provider] ?? [];
            if (options.length === 0) return [];
            return {
              id: `chat-model-${provider}`,
              label: LLM_PROVIDER_LABEL[provider],
              icon: <NamedIcon icon={LLM_PROVIDER_ICON[provider]} />,
              type: 'submenu' as const,
              submenuBoundary: 'viewport' as const,
              checked: answering?.provider === provider,
              submenuWidth: 440,
              footer: <ModelComparisonFooter />,
              submenu: comparisonOptions(provider, options).map(option => {
                const model = { provider, modelName: option.value, displayName: option.label };
                const prices = comparisonPrices(
                  pricing.rateFor(provider, option.value),
                  pricing.usdPerMillionOpenFrameTokens,
                );
                return {
                  id: `chat-model-${provider}-${option.value}`,
                  label: option.label,
                  description: comparisonDescription(option.details, prices),
                  content: <ModelComparisonRow label={option.label} details={option.details} pricing={prices} />,
                  type: 'radio' as const,
                  checked: isSameModel(answering, model),
                  onClick: () => choose(model),
                };
              }),
            };
          }),
        },
      ],
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
