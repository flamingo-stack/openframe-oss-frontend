'use client';

import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { adminQueryKeys } from './admin-query-keys';

export type ApiKeyRecord = {
  id: string;
  name: string;
  description?: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastUsed?: string | null;
  expiresAt?: string | null;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
};

async function fetchApiKeysRequest(): Promise<ApiKeyRecord[]> {
  const res = await apiClient.get<ApiKeyRecord[]>('api/api-keys');
  if (!res.ok || !Array.isArray(res.data)) {
    throw new Error(res.error || `Failed to load API keys (${res.status})`);
  }
  return res.data;
}

export function useApiKeys() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: adminQueryKeys.apiKeys(),
    queryFn: fetchApiKeysRequest,
    enabled: false,
  });

  const invalidate = useCallback(() => {
    return queryClient.invalidateQueries({ queryKey: adminQueryKeys.apiKeys() });
  }, [queryClient]);

  const fetchApiKeys = useCallback(async () => {
    const result = await queryClient.fetchQuery({
      queryKey: adminQueryKeys.apiKeys(),
      queryFn: fetchApiKeysRequest,
    });
    return result;
  }, [queryClient]);

  const createApiKeyMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string; expiresAt?: string | null }) => {
      const payload = {
        name: data.name,
        description: data.description || undefined,
        expiresAt: data.expiresAt ?? null,
      };
      const res = await apiClient.post<{ apiKey: ApiKeyRecord; fullKey: string }>('api/api-keys', payload);
      if (!res.ok || !res.data) {
        throw new Error(res.error || `Failed to create API key (${res.status})`);
      }
      return res.data;
    },
    onSuccess: () => {
      return invalidate();
    },
  });

  const updateApiKeyMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: { name: string; description?: string; expiresAt?: string | null };
    }) => {
      const payload = {
        name: data.name,
        description: data.description || undefined,
        expiresAt: data.expiresAt ?? null,
      };
      const res = await apiClient.put<ApiKeyRecord>(`api/api-keys/${encodeURIComponent(id)}`, payload);
      if (!res.ok || !res.data) {
        throw new Error(res.error || `Failed to update API key (${res.status})`);
      }
      return res.data;
    },
    onSuccess: () => {
      return invalidate();
    },
  });

  const regenerateApiKeyMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post<{ apiKey: ApiKeyRecord; fullKey: string }>(
        `api/api-keys/${encodeURIComponent(id)}/regenerate`,
      );
      if (!res.ok || !res.data) {
        throw new Error(res.error || `Failed to regenerate API key (${res.status})`);
      }
      return res.data;
    },
    onSuccess: () => {
      return invalidate();
    },
  });

  const setApiKeyEnabledMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const res = await apiClient.put<ApiKeyRecord>(`api/api-keys/${encodeURIComponent(id)}`, { enabled });
      if (!res.ok || !res.data) {
        throw new Error(res.error || `Failed to ${enabled ? 'enable' : 'disable'} API key (${res.status})`);
      }
      return res.data;
    },
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: adminQueryKeys.apiKeys() });
    },
    onSuccess: () => {
      return invalidate();
    },
  });

  const createApiKey = useCallback(
    (data: { name: string; description?: string; expiresAt?: string | null }) => createApiKeyMutation.mutateAsync(data),
    [createApiKeyMutation],
  );

  const updateApiKey = useCallback(
    (id: string, data: { name: string; description?: string; expiresAt?: string | null }) =>
      updateApiKeyMutation.mutateAsync({ id, data }),
    [updateApiKeyMutation],
  );

  const regenerateApiKey = useCallback(
    (id: string) => regenerateApiKeyMutation.mutateAsync(id),
    [regenerateApiKeyMutation],
  );

  const setApiKeyEnabled = useCallback(
    (id: string, enabled: boolean) => setApiKeyEnabledMutation.mutateAsync({ id, enabled }),
    [setApiKeyEnabledMutation],
  );

  return {
    items: query.data ?? [],
    isLoading: query.isFetching,
    error: query.error instanceof Error ? query.error.message : null,
    fetchApiKeys,
    createApiKey,
    updateApiKey,
    regenerateApiKey,
    setApiKeyEnabled,
  };
}
