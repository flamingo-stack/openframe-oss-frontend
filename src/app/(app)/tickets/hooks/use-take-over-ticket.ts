'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { EVENT_SUBTYPE, trackDashboardActivity } from '@/lib/analytics';
import { apiClient } from '@/lib/api-client';
import { API_ENDPOINTS, CHAT_TYPE, DIALOG_MODE } from '../constants';
import { ticketService } from '../services';
import { dialogsQueryKeys, ticketsQueryKeys } from '../utils/query-keys';
import { assignTicketApi } from './use-assign-ticket';

export interface TakeOverTicketInput {
  ticketId: string;
  /** Existing chat dialog id; when absent a DIRECT dialog is created instead of switching mode. */
  dialogId?: string;
  toStatusId: string;
  assigneeId: string;
}

/**
 * Take Over a ticket from the AI assistant: move it to the selected status,
 * assign the technician, and switch the client chat to direct mode (stopping
 * the AI). There is no single backend mutation for this yet, so the three
 * existing calls run sequentially; each step's error message says how far the
 * flow got, since earlier steps are not rolled back.
 */
export function useTakeOverTicket() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ticketId, dialogId, toStatusId, assigneeId }: TakeOverTicketInput) => {
      try {
        await ticketService.transitionTicket(ticketId, toStatusId);
      } catch (error) {
        throw new Error(`Failed to update status: ${error instanceof Error ? error.message : 'unknown error'}`);
      }

      try {
        await assignTicketApi({ ticketId, assigneeId });
      } catch (error) {
        throw new Error(
          `Status updated, but assigning failed: ${error instanceof Error ? error.message : 'unknown error'}`,
        );
      }

      const response = dialogId
        ? await apiClient.patch(`${API_ENDPOINTS.DIALOGS}/${dialogId}/mode`, {
            mode: DIALOG_MODE.DIRECT,
            chatType: CHAT_TYPE.CLIENT,
          })
        : await apiClient.post(API_ENDPOINTS.DIALOGS, {
            agentType: 'CLIENT',
            mode: DIALOG_MODE.DIRECT,
            ticketId,
          });
      if (!response.ok) {
        throw new Error(
          `Status and assignee updated, but starting direct chat failed: ${response.error || 'unknown error'}`,
        );
      }
    },
    onSuccess: () => {
      trackDashboardActivity(EVENT_SUBTYPE.START_DIRECT_CHAT);
      toast({
        title: 'Ticket taken over',
        description: 'The AI assistant was stopped and a direct chat with the user has started.',
        variant: 'success',
      });
    },
    onError: err => {
      toast({
        title: 'Take Over Failed',
        description: err instanceof Error ? err.message : 'Failed to take over the ticket',
        variant: 'destructive',
        duration: 5000,
      });
    },
    onSettled: (_data, _err, { ticketId }) => {
      // Refresh even on partial failure — some steps may have landed.
      queryClient.invalidateQueries({ queryKey: ticketsQueryKeys.detail(ticketId) });
      queryClient.invalidateQueries({ queryKey: ticketsQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: dialogsQueryKeys.all });
    },
  });
}
