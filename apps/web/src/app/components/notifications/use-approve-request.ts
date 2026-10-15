'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useCallback } from 'react';
import { ticketService } from '@/app/(app)/tickets/services';

/**
 * Approve or reject a Mingo tool-approval request. Toasts the outcome and returns whether it
 * succeeded so callers can decide their own follow-up (mark read, flip status, keep pending).
 */
export function useApproveRequest() {
  const { toast } = useToast();

  return useCallback(
    async (approvalRequestId: string, approve: boolean): Promise<boolean> => {
      try {
        await ticketService.resolveApprovalRequest(approvalRequestId, approve);
      } catch (error) {
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : `Failed to ${approve ? 'approve' : 'reject'} request`,
          variant: 'destructive',
        });
        return false;
      }
      toast({
        title: approve ? 'Approved' : 'Rejected',
        description: `Request ${approve ? 'approved' : 'rejected'}.`,
        variant: 'success',
      });
      return true;
    },
    [toast],
  );
}
