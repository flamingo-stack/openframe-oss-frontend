'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useCallback } from 'react';
import { useMutation } from 'react-relay';
import type { archiveScriptScheduleMutation as ArchiveScheduleMutationType } from '@/__generated__/archiveScriptScheduleMutation.graphql';
import type { unarchiveScriptScheduleMutation as UnarchiveScheduleMutationType } from '@/__generated__/unarchiveScriptScheduleMutation.graphql';
import { ScriptStatus } from '@/generated/schema-enums';
import { archiveScriptScheduleMutation } from '@/graphql/scripts/archive-script-schedule-mutation';
import { unarchiveScriptScheduleMutation } from '@/graphql/scripts/unarchive-script-schedule-mutation';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import type { ScheduleDetailData } from '../types/schedule-detail.types';

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
  const [commitArchive, isArchiving] = useMutation<ArchiveScheduleMutationType>(archiveScriptScheduleMutation);
  const [commitUnarchive, isUnarchiving] = useMutation<UnarchiveScheduleMutationType>(unarchiveScriptScheduleMutation);

  const isArchived = schedule?.status === ScriptStatus.ARCHIVED;

  const toggleArchive = useCallback(
    (onSettled?: () => void) => {
      if (!schedule) return;

      const commit = isArchived ? commitUnarchive : commitArchive;
      commit({
        // No connection to prune from here — the lists own their own connections
        // and refetch on navigation (`store-and-network`). The payload's `status`
        // is what updates the page this was called from.
        variables: { id: schedule.id, connections: [] },
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
    [schedule, isArchived, commitArchive, commitUnarchive, toast],
  );

  return { isArchived, isArchiving, isPending: isArchiving || isUnarchiving, toggleArchive };
}
