import type { ChatMessage } from '@flamingo-stack/openframe-frontend-core/chat-protocol';
import { NamedIcon } from '@flamingo-stack/openframe-frontend-core/components';
import type { ActionsMenuItem } from '@flamingo-stack/openframe-frontend-core/components/ui';
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
import { useFeatureFlagGate } from '@/app/hooks/use-feature-flag';
import type { FeatureFlagGate } from '@/lib/feature-flags';
import { liveRowState } from '../utils/dialog-row-status';
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
  messages: readonly ChatMessage[];
  archived: boolean;
  isCompacting: boolean;
}

export interface MingoModelSelection {
  gate: FeatureFlagGate;
  /** The model that answers this chat (a new chat: the draft's pick); null = the chat's own label stands. */
  current: DialogModel | null;
  /** The answering model's context, once the server said. */
  contextSize: number | null;
  /** "Chat Model" for the chat's and the composer's ⋯ menus; empty while the flag is not on. */
  menuItems: ActionsMenuItem[];
}

const sameModel = (a: DialogModelChoice | null, b: DialogModelChoice) =>
  a?.provider === b.provider && a.modelName === b.modelName;

/** The model for one Mingo chat: read from the chat, picked in its ⋯ menus; a new chat keeps its pick in a draft. */
export function useMingoModelSelection(chat: MingoModelChatState): MingoModelSelection {
  const gate = useFeatureFlagGate(MINGO_MODEL_FLAG);
  const enabled = gate === 'on';
  const { activeDialogId } = chat;
  const { modelsByProvider } = useSupportedModels();
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

  if (!enabled) return { gate, current: null, contextSize: null, menuItems: [] };

  const saved = activeDialogId ? query.data : undefined;
  const selected = activeDialogId ? (saved?.model ?? null) : draft;
  const current = activeDialogId ? (saved?.effectiveModel ?? null) : draft;
  // The server refuses a change mid-reply, while an approval waits, or in a closed chat; the menu says so first.
  const locked =
    mutation.isPending ||
    (activeDialogId !== null && query.isPending) ||
    chat.streamingPhase !== 'idle' ||
    chat.archived ||
    chat.isCompacting ||
    liveRowState(chat.streamingPhase, chat.messages).awaitingApproval;

  const choose = (model: DialogModel | null) => {
    if (activeDialogId) mutation.mutate({ dialogId: activeDialogId, model });
    else setDraft(model);
  };

  return {
    gate,
    current: current && { ...current, displayName: labelOf(current, modelsByProvider) },
    contextSize: saved?.modelTokenBudget ?? null,
    menuItems: [
      {
        id: 'chat-model',
        label: current ? labelOf(current, modelsByProvider) : 'Chat Model',
        description: current ? 'Chat Model' : undefined,
        icon: current ? <NamedIcon icon={LLM_PROVIDER_ICON[current.provider]} className="h-5 w-5" /> : undefined,
        type: 'submenu',
        // The cascade is three menus wide: it may leave the chat's column, which is narrower than that.
        submenuBoundary: 'viewport',
        disabled: locked,
        submenu: [
          {
            id: 'chat-model-default',
            label: 'Use Default Model',
            type: 'radio',
            checked: selected === null,
            onClick: () => choose(null),
          },
          ...LLM_PROVIDER_OPTIONS.flatMap(provider => {
            const options = modelsByProvider?.[provider] ?? [];
            if (options.length === 0) return [];
            return {
              id: `chat-model-${provider}`,
              label: LLM_PROVIDER_LABEL[provider],
              icon: <NamedIcon icon={LLM_PROVIDER_ICON[provider]} className="h-5 w-5" />,
              type: 'submenu' as const,
              submenu: options.map(option => {
                const model = { provider, modelName: option.value, displayName: option.label };
                return {
                  id: `chat-model-${provider}-${option.value}`,
                  label: option.label,
                  type: 'radio' as const,
                  checked: sameModel(selected, model),
                  onClick: () => choose(model),
                };
              }),
            };
          }),
        ],
      },
    ],
  };
}

function labelOf(model: DialogModel, modelsByProvider: SupportedModelsByProvider | undefined): string {
  return (
    model.displayName ??
    modelsByProvider?.[model.provider]?.find(option => option.value === model.modelName)?.label ??
    model.modelName
  );
}
