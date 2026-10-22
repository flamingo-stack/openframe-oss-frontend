'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { handleApiError } from '@/lib/handle-api-error';
import type { RecordingTicket } from '../components/remote-sessions/recording-tickets';
import {
  assignRecordingTickets,
  fetchRecordingTickets,
  unassignRecordingTicket,
} from '../services/recording-tickets-api-service';
import { deviceQueryKeys } from '../utils/query-keys';

/**
 * The tickets linked to the session the recording page shows. Re-read on
 * every visit: a ticket's assignee and status change on the Tickets pages,
 * which never touch this cache, so the app-wide minute of freshness showed
 * the old assignee after coming back.
 */
export function useRecordingTickets(recordingId: string | null) {
  return useQuery({
    queryKey: deviceQueryKeys.recordingTickets(recordingId ?? ''),
    queryFn: recordingId ? () => fetchRecordingTickets(recordingId) : skipToken,
    staleTime: 0,
  });
}

/**
 * The table takes the session's tickets from the mutation's answer; the
 * timeline gains a TICKET_ASSIGNED / TICKET_UNASSIGNED row.
 */
function useApplyRecordingTickets(recordingId: string) {
  const queryClient = useQueryClient();
  return (tickets: RecordingTicket[]) => {
    queryClient.setQueryData(deviceQueryKeys.recordingTickets(recordingId), tickets);
    void queryClient.invalidateQueries({ queryKey: deviceQueryKeys.sessionEvents(recordingId) });
  };
}

export function useAssignRecordingTickets(recordingId: string) {
  const { toast } = useToast();
  const apply = useApplyRecordingTickets(recordingId);

  return useMutation({
    mutationFn: ({ sessionId, ticketIds }: { sessionId: string; ticketIds: string[] }) =>
      assignRecordingTickets(sessionId, ticketIds),
    onSuccess: (tickets, { ticketIds }) => {
      apply(tickets);
      toast({
        title: ticketIds.length > 1 ? 'Tickets Assigned' : 'Ticket Assigned',
        description: 'Linked to this remote session',
        variant: 'success',
      });
    },
    onError: error => {
      handleApiError(error, toast, 'Failed to assign the tickets');
    },
  });
}

export function useUnassignRecordingTicket(recordingId: string) {
  const { toast } = useToast();
  const apply = useApplyRecordingTickets(recordingId);

  return useMutation({
    mutationFn: ({ sessionId, ticketId }: { sessionId: string; ticketId: string }) =>
      unassignRecordingTicket(sessionId, ticketId),
    onSuccess: tickets => {
      apply(tickets);
      toast({
        title: 'Ticket Unassigned',
        description: 'No longer linked to this remote session',
        variant: 'success',
      });
    },
    onError: error => {
      handleApiError(error, toast, 'Failed to unassign the ticket');
    },
  });
}
