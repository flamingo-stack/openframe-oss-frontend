'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useCallback } from 'react';
import { graphql, useMutation } from 'react-relay';
import type { RecordSourceSelectorProxy } from 'relay-runtime';
import type { useScheduleArchiveArchiveMutation as ArchiveScheduleMutationType } from '@/__generated__/useScheduleArchiveArchiveMutation.graphql';
import type { useScheduleArchiveUnarchiveMutation as UnarchiveScheduleMutationType } from '@/__generated__/useScheduleArchiveUnarchiveMutation.graphql';
import { ScriptStatus } from '@/generated/schema-enums';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import { markListChanged } from '@/lib/list-refresh';
import type { ScheduleDetailData } from '../types/schedule-detail.types';

// `status` is for the schedule's own page, which stays mounted on the schedule: the payload writes the new status
// into the record, so its action flips Archive <-> Restore without a refetch. The lists read their page again instead.
const archiveMutation = graphql`
  mutation useScheduleArchiveArchiveMutation($id: ID!) {
    archiveScriptSchedule(id: $id) {
      id
      status
    }
  }
`;

const unarchiveMutation = graphql`
  mutation useScheduleArchiveUnarchiveMutation($id: ID!) {
    unarchiveScriptSchedule(id: $id) {
      id
      status
    }
  }
`;

interface SetArchivedOptions {
  /** Runs on the store with the answer. */
  updater?: (store: RecordSourceSelectorProxy) => void;
  onCompleted?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Archive and unarchive for a schedule, from the schedules table and the schedule's page. Either one moves the
 * schedule from one paged list to the other, which only the server can answer: on success the schedules lists are
 * marked changed (`markListChanged`), so the one on screen reads its page again.
 */
export function useScheduleArchiveMutations() {
  const [commitArchive, isArchiving] = useMutation<ArchiveScheduleMutationType>(archiveMutation);
  const [commitUnarchive, isUnarchiving] = useMutation<UnarchiveScheduleMutationType>(unarchiveMutation);

  /** Archives the schedule (`archive: true`) or puts it back (`false`). */
  const setArchived = (id: string, archive: boolean, { updater, onCompleted, onError }: SetArchivedOptions = {}) => {
    const commit = archive ? commitArchive : commitUnarchive;
    commit({
      variables: { id },
      updater,
      onCompleted: () => {
        markListChanged('scriptSchedules');
        onCompleted?.();
      },
      onError,
    });
  };

  return { setArchived, isArchiving, isUnarchiving };
}

/**
 * Archive / unarchive for one schedule, with the toast feedback both directions
 * owe the user.
 *
 * `toggleArchive` picks the direction from the record's own status, so a caller
 * never tracks which mutation it means — it renders one action whose label comes
 * from `isArchived` and calls this. `onSettled` fires on success AND failure:
 * its caller uses it to close the confirm dialog, which must not stay open over
 * a failed archive.
 */
export function useScheduleArchive(schedule: ScheduleDetailData | null | undefined) {
  const { toast } = useToast();
  const { setArchived, isArchiving, isUnarchiving } = useScheduleArchiveMutations();

  const isArchived = schedule?.status === ScriptStatus.ARCHIVED;

  const toggleArchive = useCallback(
    (onSettled?: () => void) => {
      if (!schedule) return;

      setArchived(schedule.id, !isArchived, {
        onCompleted: () => {
          onSettled?.();
          toast(
            isArchived
              ? {
                  title: 'Schedule unarchived',
                  description: `"${schedule.name}" was moved back to Scripts Schedules.`,
                  variant: 'success',
                }
              : {
                  title: 'Schedule archived',
                  description: `"${schedule.name}" was moved to Archived Schedules.`,
                  variant: 'success',
                },
          );
        },
        onError: error => {
          onSettled?.();
          toast({
            title: 'Error',
            description: getRelayErrorMessage(error, `Failed to ${isArchived ? 'unarchive' : 'archive'} schedule`),
            variant: 'destructive',
          });
        },
      });
    },
    [schedule, isArchived, setArchived, toast],
  );

  return { isArchived, isArchiving, isPending: isArchiving || isUnarchiving, toggleArchive };
}
