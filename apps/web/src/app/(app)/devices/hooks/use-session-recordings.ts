'use client';

import type { KeepRecordingSelection } from '@flamingo-stack/openframe-frontend-core/components/features';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { handleApiError } from '@/lib/handle-api-error';
import { sessionRecordingsApiService as service } from '../services/session-recordings-api-service';
import { deviceQueryKeys } from '../utils/query-keys';
import { useSessionRecordingsGate } from './use-session-recordings-gate';

/** Remote sessions of one device, for the Remote Sessions tab. */
export function useSessionRecordings(deviceId: string | null) {
  return useQuery({
    queryKey: deviceQueryKeys.sessionRecordings(deviceId ?? ''),
    queryFn: deviceId ? () => service.list(deviceId) : skipToken,
  });
}

/** One recording's detail, for the player page. */
export function useSessionRecording(recordingId: string | null) {
  return useQuery({
    queryKey: deviceQueryKeys.sessionRecording(recordingId ?? ''),
    queryFn: recordingId ? () => service.get(recordingId) : skipToken,
  });
}

/**
 * The tenant's recording storage, for the "Recording storage full" banner.
 * Read only where recordings are on: elsewhere the field may not exist at all.
 */
export function useRecordingStorage() {
  const enabled = useSessionRecordingsGate() === 'on';
  return useQuery({
    queryKey: deviceQueryKeys.recordingStorage(),
    queryFn: enabled ? () => service.storage() : skipToken,
  });
}

/** What a delete needs: the session it removes, and the file its detail page is cached under, if any. */
export interface DeleteSessionRecordingTarget {
  sessionId: string;
  recordingId: string | null;
}

export function useDeleteSessionRecording(deviceId: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sessionId }: DeleteSessionRecordingTarget) => service.delete(sessionId),
    onSuccess: (_data, { recordingId }) => {
      void queryClient.invalidateQueries({ queryKey: deviceQueryKeys.sessionRecordings(deviceId) });
      // Deleting frees storage, so the "storage full" banner may go.
      void queryClient.invalidateQueries({ queryKey: deviceQueryKeys.recordingStorage() });
      // The files are gone - drop the cached detail instead of invalidating,
      // which would refetch a recording that no longer plays.
      if (recordingId) queryClient.removeQueries({ queryKey: deviceQueryKeys.sessionRecording(recordingId) });
      toast({ title: 'Recording Deleted', description: 'The session recording was removed', variant: 'success' });
    },
    onError: error => {
      handleApiError(error, toast, 'Failed to delete the recording');
    },
  });
}

/** What a Keep needs: the session it keeps, the file its detail page is cached under, and the dialog's choice. */
export interface KeepSessionRecordingTarget extends DeleteSessionRecordingTarget {
  selection: KeepRecordingSelection;
}

/**
 * Keep and Release both change the row, the page and the storage pools (a
 * Keep moves the session's bytes into the kept allowance, a Release back).
 */
function useRefreshKeptRecording(deviceId: string) {
  const queryClient = useQueryClient();
  return (recordingId: string | null) => {
    void queryClient.invalidateQueries({ queryKey: deviceQueryKeys.sessionRecordings(deviceId) });
    void queryClient.invalidateQueries({ queryKey: deviceQueryKeys.recordingStorage() });
    if (recordingId) void queryClient.invalidateQueries({ queryKey: deviceQueryKeys.sessionRecording(recordingId) });
  };
}

export function useKeepSessionRecording(deviceId: string) {
  const { toast } = useToast();
  const refresh = useRefreshKeptRecording(deviceId);

  return useMutation({
    mutationFn: ({ sessionId, selection }: KeepSessionRecordingTarget) => service.keep(sessionId, selection),
    onSuccess: (_data, { recordingId }) => {
      refresh(recordingId);
      toast({ title: 'Recording Kept', description: "It won't be deleted automatically", variant: 'success' });
    },
    onError: error => {
      handleApiError(error, toast, 'Failed to keep the recording');
    },
  });
}

export function useReleaseSessionRecording(deviceId: string) {
  const { toast } = useToast();
  const refresh = useRefreshKeptRecording(deviceId);

  return useMutation({
    mutationFn: ({ sessionId }: DeleteSessionRecordingTarget) => service.release(sessionId),
    onSuccess: (_data, { recordingId }) => {
      refresh(recordingId);
      toast({ title: 'Keeping Released', description: 'Nothing is deleted now', variant: 'success' });
    },
    onError: error => {
      handleApiError(error, toast, 'Failed to release the recording');
    },
  });
}
