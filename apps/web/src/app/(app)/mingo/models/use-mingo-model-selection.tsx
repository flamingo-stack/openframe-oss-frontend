import { NamedIcon } from '@flamingo-stack/openframe-frontend-core/components';
import type { ModelMenu } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { ShieldCheckIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
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
import { useAiModelStatus } from '@/app/hooks/use-ai-model';
import { useFeatureFlagGate } from '@/app/hooks/use-feature-flag';
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
  /** The composer's model menu; null while the flag is not on. */
  menu: ModelMenu | null;
}

const RETENTION_NOTE = (
  <div className="flex max-w-[440px] items-start gap-[var(--spacing-system-xsf)] p-[var(--spacing-system-mf)] text-ods-text-secondary text-h6">
    <ShieldCheckIcon aria-hidden size={16} className="shrink-0" />
    <p>Your chats aren’t used to train AI models. Model providers keep requests for up to 30 days, then delete them.</p>
  </div>
);

/** The model for one Mingo chat: read from the chat, picked from its composer; a new chat keeps its pick in a draft. */
export function useMingoModelSelection(chat: MingoModelChatState): MingoModelSelection {
  const gate = useFeatureFlagGate(MINGO_MODEL_FLAG);
  const enabled = gate === 'on';
  const { activeDialogId } = chat;
  const { modelsByProvider } = useSupportedModels();
  const { aiModel } = useAiModelStatus();
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

  if (!enabled) return { gate, current: null, contextSize: null, menu: null };

  const saved = activeDialogId ? query.data : undefined;
  const selected = activeDialogId ? (saved?.model ?? null) : draft;
  const current = activeDialogId ? (saved?.effectiveModel ?? null) : draft;
  // The model that answers: the chat's, else the tenant default a new chat starts on.
  const answering = current ?? aiModel;
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
    menu: {
      disabled: locked,
      groups: [
        {
          separator: true,
          items: [
            {
              id: 'chat-model-default',
              label: 'Use Default Model',
              type: 'radio',
              checked: selected === null,
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
              footer: RETENTION_NOTE,
              submenu: options.map(option => {
                const model = { provider, modelName: option.value, displayName: option.label };
                return {
                  id: `chat-model-${provider}-${option.value}`,
                  label: option.label,
                  type: 'radio' as const,
                  checked: answering?.provider === provider && answering.modelName === option.value,
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
