'use client';

import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';

export function useCustomerArchive() {
  const queryClient = useQueryClient();

  const checkCanArchive = useCallback(async (id: string): Promise<boolean> => {
    const resp = await apiClient.get<boolean>(`/api/organizations/${id}/can-archive`);
    if (!resp.ok) {
      throw new Error(resp.error || 'Failed to check archive eligibility');
    }
    return resp.data as boolean;
  }, []);

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const resp = await apiClient.patch(`/api/organizations/${id}/status`, { status: 'ARCHIVED' });
      if (!resp.ok) {
        throw new Error(resp.error || 'Failed to archive customer');
      }
      return resp.data;
    },
    onSuccess: () => {
      toast.success('Customer archived');
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to archive customer');
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      const resp = await apiClient.patch(`/api/organizations/${id}/status`, { status: 'ACTIVE' });
      if (!resp.ok) {
        throw new Error(resp.error || 'Failed to restore customer');
      }
      return resp.data;
    },
    onSuccess: () => {
      toast.success('Customer restored');
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to restore customer');
    },
  });

  return {
    checkCanArchive,
    archiveOrganization: archiveMutation.mutateAsync,
    restoreOrganization: restoreMutation.mutateAsync,
    isArchiving: archiveMutation.isPending,
    isRestoring: restoreMutation.isPending,
  };
}
