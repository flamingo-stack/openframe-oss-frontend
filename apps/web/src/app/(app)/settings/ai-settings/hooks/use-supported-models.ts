'use client';

import { useQuery } from '@tanstack/react-query';
import { extractGraphQlData } from '@/app/(app)/tickets/utils/graphql';
import { apiClient } from '@/lib/api-client';
import type { AIProvider } from '../types/ai-settings';
import type { GraphqlResponse } from './chat-graphql';

const GET_SUPPORTED_AI_MODELS_QUERY = `
  query SupportedAiModels {
    supportedAiModels {
      provider
      models { modelName displayName }
    }
  }
`;

interface SupportedAiModelGroupGql {
  provider: AIProvider;
  models: { modelName: string; displayName: string | null }[];
}

export interface ProviderModelOption {
  value: string;
  label: string;
}

export type SupportedModelsByProvider = Partial<Record<AIProvider, ProviderModelOption[]>>;

export const supportedModelsQueryKey = ['ai-configuration', 'supported-models'] as const;

/** Model options per provider from the chat backend's configuration. */
export function useSupportedModels() {
  const query = useQuery({
    queryKey: supportedModelsQueryKey,
    queryFn: async (): Promise<SupportedModelsByProvider> => {
      const response = await apiClient.post<GraphqlResponse<{ supportedAiModels: SupportedAiModelGroupGql[] }>>(
        '/chat/graphql',
        { query: GET_SUPPORTED_AI_MODELS_QUERY },
      );
      const { supportedAiModels } = extractGraphQlData(response);

      const byProvider: SupportedModelsByProvider = {};
      for (const group of supportedAiModels) {
        byProvider[group.provider] = group.models.map(model => ({
          value: model.modelName,
          label: model.displayName ?? model.modelName,
        }));
      }
      return byProvider;
    },
  });

  return { modelsByProvider: query.data, isLoading: query.isLoading, error: query.error };
}

/** Resolves a stored model name to its display name; falls back to the raw value. */
export function getProviderModelLabel(
  modelsByProvider: SupportedModelsByProvider | undefined,
  provider: AIProvider,
  modelName: string,
): string {
  return modelsByProvider?.[provider]?.find(model => model.value === modelName)?.label ?? modelName;
}

/**
 * Cross-provider variant of {@link getProviderModelLabel} for sources that
 * carry a provider DISPLAY name instead of the AIProvider enum (message
 * AssistantOwner metadata, stream chunks). Model names are unique across
 * providers, so the first match wins; falls back to the raw value.
 */
export function getModelLabelByName(
  modelsByProvider: SupportedModelsByProvider | undefined,
  modelName: string,
): string {
  for (const models of Object.values(modelsByProvider ?? {})) {
    const match = models?.find(model => model.value === modelName);
    if (match) return match.label;
  }
  return modelName;
}
