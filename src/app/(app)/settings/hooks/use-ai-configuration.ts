import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

interface AiConfiguration {
  id: string;
  provider: 'OPENAI' | 'ANTHROPIC' | 'GOOGLE_GEMINI';
  modelName: string;
  isActive: boolean;
  hasApiKey: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ModelInfo {
  modelName: string;
  displayName: string;
  provider: 'OPENAI' | 'ANTHROPIC' | 'GOOGLE_GEMINI';
  contextWindow: number;
}

interface SupportedModels {
  anthropic?: ModelInfo[];
  openai?: ModelInfo[];
  'google-gemini'?: ModelInfo[];
}

interface UpdateAiConfigurationParams {
  provider: string;
  modelName: string;
  apiKey?: string;
}

const AI_CONFIGURATION_QUERY_KEY = ['ai-configuration'] as const;
const SUPPORTED_MODELS_QUERY_KEY = ['ai-configuration', 'supported-models'] as const;

export function useAiConfiguration() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const fetchConfiguration = async (): Promise<AiConfiguration | null> => {
    const response = await apiClient.get<AiConfiguration>('/chat/api/v1/ai-configuration');

    if (!response.ok) {
      throw new Error(response.error || 'Failed to fetch AI configuration');
    }

    return response.data ?? null;
  };

  const fetchSupportedModels = async (): Promise<SupportedModels> => {
    const response = await apiClient.get<SupportedModels>('/chat/api/v1/ai-configuration/supported-models');

    if (!response.ok) {
      throw new Error(response.error || 'Failed to fetch supported models');
    }

    return response.data ?? {};
  };

  const configurationQuery = useQuery({
    queryKey: AI_CONFIGURATION_QUERY_KEY,
    queryFn: fetchConfiguration,
  });

  const supportedModelsQuery = useQuery({
    queryKey: SUPPORTED_MODELS_QUERY_KEY,
    queryFn: fetchSupportedModels,
  });

  if (configurationQuery.isError) {
    toast({
      title: 'Failed to Load Configuration',
      description:
        configurationQuery.error instanceof Error
          ? configurationQuery.error.message
          : 'Unable to load AI settings',
      variant: 'destructive',
      duration: 5000,
    });
  }

  if (supportedModelsQuery.isError) {
    toast({
      title: 'Failed to Load Models',
      description: 'Unable to fetch supported AI models',
      variant: 'destructive',
      duration: 5000,
    });
  }

  const updateConfigurationMutation = useMutation({
    mutationFn: async (params: UpdateAiConfigurationParams) => {
      // `apiKey` is omitted rather than sent empty: the backend treats an absent
      // key as "keep the stored one" and an empty string as "clear it".
      const body: { provider: string; modelName: string; apiKey?: string } = {
        provider: params.provider,
        modelName: params.modelName,
      };

      if (params.apiKey?.trim()) {
        body.apiKey = params.apiKey;
      }

      const response = await apiClient.post<AiConfiguration>('/chat/api/v1/ai-configuration', body);

      if (!response.ok) {
        throw new Error(response.error || 'Failed to save AI configuration');
      }

      return response.data ?? null;
    },
    onSuccess: async () => {
      toast({
        title: 'Settings Saved',
        description: 'AI configuration updated successfully',
        variant: 'success',
        duration: 4000,
      });

      await queryClient.invalidateQueries({ queryKey: AI_CONFIGURATION_QUERY_KEY });
    },
    onError: (error) => {
      toast({
        title: 'Save Failed',
        description: error instanceof Error ? error.message : 'Unable to save AI settings',
        variant: 'destructive',
        duration: 5000,
      });
    },
  });

  const updateConfiguration = async (params: UpdateAiConfigurationParams) => {
    return updateConfigurationMutation.mutateAsync(params);
  };

  return {
    configuration: configurationQuery.data ?? null,
    supportedModels: supportedModelsQuery.data ?? {},
    isLoading: configurationQuery.isLoading || supportedModelsQuery.isLoading,
    isSaving: updateConfigurationMutation.isPending,
    fetchConfiguration: configurationQuery.refetch,
    fetchSupportedModels: supportedModelsQuery.refetch,
    updateConfiguration,
  };
}
