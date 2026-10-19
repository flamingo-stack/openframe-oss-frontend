import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useMutation } from '@tanstack/react-query';
import { CHAT_TYPE } from '../../tickets/constants';
import { ticketService } from '../../tickets/services';
import type { SendMessageContext } from '../../tickets/services/ticket-service.types';

/**
 * Custom hooks for Mingo chat operations on the ai-agent GraphQL commands
 * Provides react-query mutations for dialog creation, message sending, and approvals
 */

/**
 * Create a new dialog - returns mutation resolving to the raw dialog id
 */
export function useCreateDialogMutation() {
  return useMutation({
    mutationFn: ({ insightId }: { insightId?: string } = {}) =>
      ticketService.createDialog({ agentType: 'ADMIN', ...(insightId && { insightId }) }),
  });
}

/**
 * Send a message to a dialog - returns mutation
 */
export function useSendMessageMutation() {
  return useMutation({
    mutationFn: ({ dialogId, content, ...context }: { dialogId: string; content: string } & SendMessageContext) =>
      ticketService.sendMessage(dialogId, content, CHAT_TYPE.ADMIN, context),
  });
}

/**
 * Approve an approval request - returns mutation
 */
export function useApproveRequestMutation() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: (requestId: string) => ticketService.resolveApprovalRequest(requestId, true),
    onSuccess: () => {
      toast({
        title: 'Request Approved',
        description: 'The request has been approved successfully.',
        duration: 5000,
      });
    },
    onError: error => {
      const errorMessage = error instanceof Error ? error.message : 'Failed to approve request';
      toast({
        title: 'Approval Failed',
        description: errorMessage,
        variant: 'destructive',
        duration: 5000,
      });
    },
  });
}

/**
 * Stop AI response generation for a dialog
 */
export function useStopGenerationMutation() {
  return useMutation({
    mutationFn: (dialogId: string) => ticketService.stopDialogGeneration(dialogId, CHAT_TYPE.ADMIN),
  });
}

/**
 * Reject an approval request - returns mutation
 */
export function useRejectRequestMutation() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: (requestId: string) => ticketService.resolveApprovalRequest(requestId, false),
    onSuccess: () => {
      toast({
        title: 'Request Rejected',
        description: 'The request has been rejected successfully.',
        duration: 5000,
      });
    },
    onError: error => {
      const errorMessage = error instanceof Error ? error.message : 'Failed to reject request';
      toast({
        title: 'Rejection Failed',
        description: errorMessage,
        variant: 'destructive',
        duration: 5000,
      });
    },
  });
}
