'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { handleApiError } from '@/lib/handle-api-error';
import { deviceQueryKeys } from '../utils/query-keys';
import { useSessionRecordingsService } from './use-session-recordings-service';

/** Remote sessions of one device, for the Remote Sessions tab. */
export function useSessionRecordings(deviceId: string | null) {
  const { service, isMock, ready } = useSessionRecordingsService();
  return useQuery({
    queryKey: deviceQueryKeys.sessionRecordings(isMock, deviceId ?? ''),
    queryFn: deviceId && ready ? () => service.list(deviceId) : skipToken,
  });
}

/** One recording's detail, for the player page. */
export function useSessionRecording(recordingId: string | null) {
  const { service, isMock, ready } = useSessionRecordingsService();
  return useQuery({
    queryKey: deviceQueryKeys.sessionRecording(isMock, recordingId ?? ''),
    queryFn: recordingId && ready ? () => service.get(recordingId) : skipToken,
  });
}

export function useDeleteSessionRecording(deviceId: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { service, isMock } = useSessionRecordingsService();

  return useMutation({
    mutationFn: (recordingId: string) => service.delete(recordingId),
    onSuccess: (_data, recordingId) => {
      queryClient.invalidateQueries({ queryKey: deviceQueryKeys.sessionRecordings(isMock, deviceId) });
      // The record is gone - drop its cached detail instead of invalidating,
      // which would refetch a recording that no longer exists.
      queryClient.removeQueries({ queryKey: deviceQueryKeys.sessionRecording(isMock, recordingId) });
      toast({ title: 'Recording Deleted', description: 'The session recording was removed', variant: 'success' });
    },
    onError: error => {
      handleApiError(error, toast, 'Failed to delete the recording');
    },
  });
}
