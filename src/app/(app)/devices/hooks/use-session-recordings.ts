'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { handleApiError } from '@/lib/handle-api-error';
import { sessionRecordingsService } from '../services/session-recordings-service';
import { deviceQueryKeys } from '../utils/query-keys';

/** Recordings of one device, for the Remote Sessions tab. */
export function useSessionRecordings(deviceId: string | null) {
  return useQuery({
    queryKey: deviceQueryKeys.sessionRecordings(deviceId ?? ''),
    queryFn: deviceId ? () => sessionRecordingsService.list(deviceId) : skipToken,
  });
}

/** One recording's detail, for the player page. */
export function useSessionRecording(recordingId: string | null) {
  return useQuery({
    queryKey: deviceQueryKeys.sessionRecording(recordingId ?? ''),
    queryFn: recordingId ? () => sessionRecordingsService.get(recordingId) : skipToken,
  });
}

export function useDeleteSessionRecording(deviceId: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (recordingId: string) => sessionRecordingsService.delete(recordingId),
    onSuccess: (_data, recordingId) => {
      queryClient.invalidateQueries({ queryKey: deviceQueryKeys.sessionRecordings(deviceId) });
      // The record is gone - drop its cached detail instead of invalidating,
      // which would refetch a recording that no longer exists.
      queryClient.removeQueries({ queryKey: deviceQueryKeys.sessionRecording(recordingId) });
      toast({ title: 'Recording Deleted', description: 'The session recording was removed', variant: 'success' });
    },
    onError: error => {
      handleApiError(error, toast, 'Failed to delete the recording');
    },
  });
}
