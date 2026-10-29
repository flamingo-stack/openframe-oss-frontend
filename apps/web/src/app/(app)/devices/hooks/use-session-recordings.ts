'use client';

import type { KeepRecordingSelection } from '@flamingo-stack/openframe-frontend-core/components/features';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { handleApiError } from '@/lib/handle-api-error';
import { sessionRecordingsApiService as service } from '../services/session-recordings-api-service';
import { RecordingNotFoundError } from '../services/session-recordings-service';
import type { RecordingSummary } from '../types/session-recording';
import { deviceQueryKeys } from '../utils/query-keys';
import { useSessionRecordingsGate } from './use-session-recordings-gate';

/** How often a polled list is read again: a session started or ended elsewhere shows within this. */
const LIVE_POLL_MS = 10_000;

/**
 * Remote sessions of one device, for the Remote Sessions tab. With `poll` (Watch live on) the list is read again every
 * 10 s, paused while the browser tab is hidden, so a session that starts or ends shows without a reload.
 */
export function useSessionRecordings(deviceId: string | null, { poll = false }: { poll?: boolean } = {}) {
  return useQuery({
    queryKey: deviceQueryKeys.sessionRecordings(deviceId ?? ''),
    queryFn: deviceId ? () => service.list(deviceId) : skipToken,
    refetchInterval: poll ? LIVE_POLL_MS : false,
  });
}

/** One recording's detail, for the player page. A recording the server has not got is an answer, not a failure to retry. */
export function useSessionRecording(recordingId: string | null) {
  return useQuery({
    queryKey: deviceQueryKeys.sessionRecording(recordingId ?? ''),
    queryFn: recordingId ? () => service.get(recordingId) : skipToken,
    retry: (failureCount, error) => !(error instanceof RecordingNotFoundError) && failureCount < 3,
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
export interface DeleteRemoteSessionTarget {
  sessionId: string;
  recordingId: string | null;
  /** The session's device, when the list it was deleted from spans every device; the hook's device otherwise. */
  deviceId?: string;
}

/** Deletes a whole remote session - its recording and its data - which then leaves every list. */
export function useDeleteRemoteSession(deviceId: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sessionId }: DeleteRemoteSessionTarget) => service.delete(sessionId),
    onSuccess: (_data, { sessionId, recordingId, deviceId: targetDeviceId }) => {
      const listKey = deviceQueryKeys.sessionRecordings(targetDeviceId ?? deviceId);
      // Out of the cached list now, so the tab the user lands on never shows it
      // while the refetch confirms.
      queryClient.setQueryData<RecordingSummary[]>(listKey, rows => rows?.filter(row => row.id !== sessionId));
      void queryClient.invalidateQueries({ queryKey: listKey });
      // Deleting frees storage, so the "storage full" banner may go.
      void queryClient.invalidateQueries({ queryKey: deviceQueryKeys.recordingStorage() });
      // The session is gone - drop the cached detail instead of invalidating,
      // which would refetch a recording that is no longer there.
      if (recordingId) queryClient.removeQueries({ queryKey: deviceQueryKeys.sessionRecording(recordingId) });
      toast({
        title: 'Session Deleted',
        description: 'The session and its recording were removed',
        variant: 'success',
      });
    },
    onError: error => {
      handleApiError(error, toast, 'Failed to delete the session');
    },
  });
}

/** What a Keep needs: the session it keeps, the file its detail page is cached under, and the dialog's choice. */
export interface KeepSessionRecordingTarget extends DeleteRemoteSessionTarget {
  selection: KeepRecordingSelection;
}

/**
 * Keep and Release both change the row, the page, its events and the storage
 * pools (a Keep moves the session's bytes into the kept allowance, a Release back).
 */
function useRefreshKeptRecording(deviceId: string) {
  const queryClient = useQueryClient();
  return (recordingId: string | null) => {
    void queryClient.invalidateQueries({ queryKey: deviceQueryKeys.sessionRecordings(deviceId) });
    void queryClient.invalidateQueries({ queryKey: deviceQueryKeys.recordingStorage() });
    if (!recordingId) return;
    void queryClient.invalidateQueries({ queryKey: deviceQueryKeys.sessionRecording(recordingId) });
    // The Keep or the Release is a row of the session's events.
    void queryClient.invalidateQueries({ queryKey: deviceQueryKeys.sessionEvents(recordingId) });
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
    mutationFn: ({ sessionId }: DeleteRemoteSessionTarget) => service.release(sessionId),
    onSuccess: (_data, { recordingId }) => {
      refresh(recordingId);
      toast({ title: 'Keeping Released', description: 'Nothing is deleted now', variant: 'success' });
    },
    onError: error => {
      handleApiError(error, toast, 'Failed to release the recording');
    },
  });
}
