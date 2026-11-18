import type { UnifiedChatState } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo } from 'react';
import { useSupportedModels } from '@/app/(app)/settings/ai-settings/hooks/use-supported-models';
import { LLM_PROVIDER_OPTIONS } from '@/app/(app)/settings/ai-settings/utils/ai-settings-display';
import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';
import { useAiModelStatus } from '@/app/hooks/use-ai-model';
import { useFeatureFlagGate } from '@/app/hooks/use-feature-flag';
import { liveRowState } from '../utils/dialog-row-status';
import { mingoModelMenu } from './mingo-model-menu';
import type { DialogModel, DialogModelInput } from './mingo-model.types';

export const MINGO_MODEL_FLAG = 'ai-mingo-chat-model-selection';
const modelQueryKey = (id: string | null, userId: string | undefined) => ['mingo-dialog-model', userId, id] as const;

type ChatModelState = Pick<UnifiedChatState, 'activeDialogId' | 'activeDialog' | 'streamingPhase' | 'isLoading'> &
  Partial<Pick<UnifiedChatState, 'messages' | 'isCompacting'>>;

/** Keeps a draft's choice local and reads a saved chat's model before offering another choice. */
export function useMingoModelSelection(
  state: ChatModelState,
  {
    draftModel,
    onDraftChange,
    isCreatingDialog = false,
  }: {
    draftModel: DialogModelInput | null;
    onDraftChange: (model: DialogModelInput | null) => void;
    isCreatingDialog?: boolean;
  },
) {
  const gate = useFeatureFlagGate(MINGO_MODEL_FLAG);
  const { aiModel } = useAiModelStatus();
  const { modelsByProvider, isLoading: catalogLoading, error: catalogError } = useSupportedModels();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { activeDialogId } = state;
  const userId = useAuthStore(auth => auth.user?.id);
  const query = useQuery({
    queryKey: modelQueryKey(activeDialogId, userId),
    queryFn: () => {
      if (!activeDialogId) throw new Error('No chat is selected');
      return import('./mingo-model-api-service').then(api => api.readDialogModel(activeDialogId));
    },
    enabled: gate === 'on' && activeDialogId !== null,
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: true,
    refetchInterval: current => (gate === 'on' && activeDialogId && current.state.status !== 'error' ? 15_000 : false),
  });
  const mutation = useMutation({
    mutationFn: ({ id, model }: { id: string; model: DialogModelInput | null }) =>
      import('./mingo-model-api-service').then(api => api.updateDialogModel(id, model)),
  });

  useEffect(() => {
    if (activeDialogId) onDraftChange(null);
  }, [activeDialogId, onDraftChange]);

  const defaultProvider = LLM_PROVIDER_OPTIONS.find(provider => provider === aiModel?.provider);
  const defaultModel: DialogModel | null =
    aiModel?.modelName && defaultProvider
      ? { provider: defaultProvider, modelName: aiModel.modelName, displayName: aiModel.displayName }
      : null;
  const draftDisplay: DialogModel | null = draftModel
    ? {
        ...draftModel,
        displayName:
          modelsByProvider?.[draftModel.provider]?.find(model => model.value === draftModel.modelName)?.label ??
          draftModel.modelName,
      }
    : defaultModel;
  const effectiveModel = activeDialogId ? (query.data?.effectiveModel ?? null) : draftDisplay;
  const unavailable = gate === 'on' && (query.isError || !!catalogError);
  const isLoading = gate === 'loading' || (gate === 'on' && (catalogLoading || (!!activeDialogId && query.isPending)));
  const protectedState =
    query.data &&
    (query.data.agentType !== 'ADMIN' ||
      query.data.streamState !== 'IDLE' ||
      query.data.pendingApproval !== null ||
      ['ARCHIVED', 'RESOLVED'].includes(query.data.status));
  const livePendingApproval = liveRowState(state.streamingPhase, state.messages ?? []).awaitingApproval;
  const disabled =
    gate !== 'on' ||
    isLoading ||
    unavailable ||
    mutation.isPending ||
    isCreatingDialog ||
    state.isLoading ||
    state.streamingPhase !== 'idle' ||
    !!state.activeDialog?.archived ||
    !!protectedState ||
    !!state.isCompacting ||
    livePendingApproval;

  const saveSelectedModel = useCallback(
    async (dialogId: string, model: DialogModelInput | null) => {
      await queryClient.cancelQueries({ queryKey: modelQueryKey(dialogId, userId) });
      const updated = await mutation.mutateAsync({ id: query.data?.id ?? dialogId, model });
      queryClient.setQueryData(modelQueryKey(dialogId, userId), updated);
    },
    [mutation, query.data?.id, queryClient, userId],
  );
  const reportModelChangeError = useCallback(
    (error: unknown) => {
      toast({
        title: 'Could not change chat model',
        description: error instanceof Error ? error.message : 'Please try again',
        variant: 'destructive',
      });
      void query.refetch();
    },
    [toast, query],
  );
  const selectModel = useCallback(
    async (model: DialogModelInput | null) => {
      if (disabled) return;
      if (!activeDialogId) {
        onDraftChange(model);
        return;
      }
      try {
        await saveSelectedModel(activeDialogId, model);
      } catch (error) {
        reportModelChangeError(error);
      }
    },
    [disabled, activeDialogId, onDraftChange, saveSelectedModel, reportModelChangeError],
  );
  const { refetch } = query;
  useEffect(() => {
    if (gate === 'on' && activeDialogId && state.streamingPhase === 'idle') void refetch();
  }, [gate, activeDialogId, state.streamingPhase, refetch]);
  const selected = activeDialogId ? (query.data?.model ?? null) : draftModel;
  const menuItems = useMemo(
    () => (gate === 'on' ? mingoModelMenu({ modelsByProvider, selected, disabled, select: selectModel }) : []),
    [gate, modelsByProvider, selected, disabled, selectModel],
  );
  return {
    gate,
    effectiveModel,
    contextSize: activeDialogId ? (query.data?.contextSize ?? null) : null,
    selectedModel: selected,
    selectModel,
    menuItems,
    disabled,
    isLoading,
    unavailable,
  };
}
