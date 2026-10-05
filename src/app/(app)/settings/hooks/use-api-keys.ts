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

export function useApiKeys() {
  const queryClient = useQueryClient();

  const {
    data: items = [],
    isLoading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: adminQueryKeys.apiKeys.list(),
    queryFn: async () => {
      const res = await apiClient.get<ApiKeyRecord[]>('/api/api-keys');
      if (!res.ok || !Array.isArray(res.data)) {
        throw new Error(res.error || `Failed to load API keys (${res.status})`);
      }
      return res.data;
    },
  });

  const error = queryError instanceof Error ? queryError.message : queryError ? String(queryError) : null;

  const fetchApiKeys = useCallback(async () => {
    const result = await refetch();
    if (result.error) {
      throw result.error;
    }
    return result.data ?? [];
  }, [refetch]);

  const createApiKeyMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string; expiresAt?: string | null }) => {
      const payload = {
        name: data.name,
        description: data.description || undefined,
        expiresAt: data.expiresAt ?? null,
      };
      const res = await apiClient.post<{ apiKey: ApiKeyRecord; fullKey: string }>('/api/api-keys', payload);
      if (!res.ok || !res.data) {
        throw new Error(res.error || `Failed to create API key (${res.status})`);
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.apiKeys.all });
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
      const res = await apiClient.put<ApiKeyRecord>(`/api/api-keys/${encodeURIComponent(id)}`, payload);
      if (!res.ok || !res.data) {
        throw new Error(res.error || `Failed to update API key (${res.status})`);
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.apiKeys.all });
    },
  });

  const regenerateApiKeyMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post<{ apiKey: ApiKeyRecord; fullKey: string }>(
        `/api/api-keys/${encodeURIComponent(id)}/regenerate`,
      );
      if (!res.ok || !res.data) {
        throw new Error(res.error || `Failed to regenerate API key (${res.status})`);
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.apiKeys.all });
    },
  });

  const setApiKeyEnabledMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const res = await apiClient.put<ApiKeyRecord>(`/api/api-keys/${encodeURIComponent(id)}`, { enabled });
      if (!res.ok || !res.data) {
        throw new Error(res.error || `Failed to ${enabled ? 'enable' : 'disable'} API key (${res.status})`);
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.apiKeys.all });
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

  return { items, isLoading, error, fetchApiKeys, createApiKey, updateApiKey, regenerateApiKey, setApiKeyEnabled };
}
