'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { AIProvider } from '../types/ai-settings';
import { type GraphqlResponse, type MutationPayloadGql, throwOnErrors } from './chat-graphql';

const SAVE_TENANT_AI_MODEL_CONFIG_MUTATION = `
  mutation SaveTenantAiModelConfig($input: TenantAiModelConfigInput!) {
    saveTenantAiModelConfig(input: $input) {
      userErrors { field message }
    }
  }
`;

interface UpdateAiConfigurationInput {
  provider: AIProvider;
  modelName: string;
}

/**
 * Syncs the chat backend's active AI configuration with the provider/model
 * chosen in the AI config. Success feedback is owned by the settings save;
 * this only reports failures.
 */
export function useUpdateAiConfiguration() {
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (input: UpdateAiConfigurationInput) => {
      const response = await apiClient.post<GraphqlResponse<Record<string, MutationPayloadGql>>>('/chat/graphql', {
        query: SAVE_TENANT_AI_MODEL_CONFIG_MUTATION,
        variables: { input },
      });
      throwOnErrors(response, 'Failed to update AI configuration');
    },
    // No cache invalidation needed: the model badges now read adminAiConfig /
    // organizationClientAiConfig, which the settings mutations invalidate.
    onError: error => {
      toast({
        title: 'AI configuration not updated',
        description: error instanceof Error ? error.message : 'Failed to update AI configuration',
        variant: 'destructive',
      });
    },
  });

  return { updateAiConfiguration: mutation.mutate, isPending: mutation.isPending };
}
