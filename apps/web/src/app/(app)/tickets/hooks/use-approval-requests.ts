'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { APPROVAL_STATUS, type ApprovalStatus } from '../constants';
import { ticketService } from '../services';
import { toast } from 'sonner';

export type ApprovalRequestAction = {
  requestId: string;
  approve: boolean;
};

export function useApprovalRequests() {
  const queryClient = useQueryClient();

  const approvalMutation = useMutation({
    mutationFn: ({ requestId, approve }: ApprovalRequestAction) =>
      ticketService.resolveApprovalRequest(requestId, approve),
    onSuccess: (_data, variables) => {
      toast.success(
        variables.approve ? 'Request approved' : 'Request rejected',
      );
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      queryClient.invalidateQueries({ queryKey: ['approvalRequests'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to resolve approval request');
    },
  });

  const handleApproveRequest = async (
    requestId: string,
    options?: {
      onSuccess?: (status: ApprovalStatus) => void;
      onError?: (error: Error) => void;
    },
  ) => {
    try {
      await approvalMutation.mutateAsync({ requestId, approve: true });
      options?.onSuccess?.(APPROVAL_STATUS.APPROVED);
    } catch (error) {
      options?.onError?.(error as Error);
      throw error;
    }
  };

  const handleRejectRequest = async (
    requestId: string,
    options?: {
      onSuccess?: (status: ApprovalStatus) => void;
      onError?: (error: Error) => void;
    },
  ) => {
    try {
      await approvalMutation.mutateAsync({ requestId, approve: false });
      options?.onSuccess?.(APPROVAL_STATUS.REJECTED);
    } catch (error) {
      options?.onError?.(error as Error);
      throw error;
    }
  };

  return {
    handleApproveRequest,
    handleRejectRequest,
    isLoading: approvalMutation.isPending,
    error: approvalMutation.error?.message ?? null,
    approvalMutation,
  };
}
