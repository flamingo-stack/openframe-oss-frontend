'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useState } from 'react';
import { useMutation } from 'react-relay';
import type { acknowledgeInsightMutation as AcknowledgeInsightMutationType } from '@/__generated__/acknowledgeInsightMutation.graphql';
import type { archiveInsightMutation as ArchiveInsightMutationType } from '@/__generated__/archiveInsightMutation.graphql';
import type { reopenInsightMutation as ReopenInsightMutationType } from '@/__generated__/reopenInsightMutation.graphql';
import type { resolveInsightMutation as ResolveInsightMutationType } from '@/__generated__/resolveInsightMutation.graphql';
import type { snoozeInsightMutation as SnoozeInsightMutationType } from '@/__generated__/snoozeInsightMutation.graphql';
import { InsightStatus } from '@/generated/schema-enums';
import { acknowledgeInsightMutation } from '@/graphql/insights/acknowledge-insight-mutation';
import { archiveInsightMutation } from '@/graphql/insights/archive-insight-mutation';
import { reopenInsightMutation } from '@/graphql/insights/reopen-insight-mutation';
import { resolveInsightMutation } from '@/graphql/insights/resolve-insight-mutation';
import { snoozeInsightMutation } from '@/graphql/insights/snooze-insight-mutation';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import { INCIDENT_STATUS_LABELS, INCIDENT_TRANSITION_ACTIONS } from '../utils/incident-labels';

/** What a transition needs to know about its incident: the id to mutate and the title for the toast. */
export interface TransitionTarget {
  id: string;
  title: string;
}

/**
 * The five status transitions behind one `transition(target, status)` call,
 * shared by the list's row menu and the detail header. Each mutation returns
 * the fields it changes, so the payload rewrites the Insight record in place
 * and every subscriber re-renders; `onTransitioned` is for whatever else went
 * stale (the list's facet counts).
 *
 * Snooze needs a moment, so it is a two-step: `transition(…, SNOOZED)` parks
 * the incident in `snoozeTarget` for the modal, `confirmSnooze(until)` sends it.
 */
export function useIncidentTransitions(onTransitioned?: () => void) {
  const { toast } = useToast();

  const [commitAcknowledge, isAcknowledging] = useMutation<AcknowledgeInsightMutationType>(acknowledgeInsightMutation);
  const [commitSnooze, isSnoozing] = useMutation<SnoozeInsightMutationType>(snoozeInsightMutation);
  const [commitResolve, isResolving] = useMutation<ResolveInsightMutationType>(resolveInsightMutation);
  const [commitArchive, isArchiving] = useMutation<ArchiveInsightMutationType>(archiveInsightMutation);
  const [commitReopen, isReopening] = useMutation<ReopenInsightMutationType>(reopenInsightMutation);
  const isMutating = isAcknowledging || isSnoozing || isResolving || isArchiving || isReopening;

  const [snoozeTarget, setSnoozeTarget] = useState<TransitionTarget | null>(null);
  const cancelSnooze = () => setSnoozeTarget(null);

  // Shared completion handlers: a toast either way. `getRelayErrorMessage`
  // surfaces the backend's transition / concurrent-modification errors verbatim.
  const feedback = (target: TransitionTarget, status: InsightStatus) => ({
    onCompleted: () => {
      toast({
        title: `Incident ${INCIDENT_TRANSITION_ACTIONS[status].done}`,
        description: `"${target.title}" is now ${INCIDENT_STATUS_LABELS[status].toLowerCase()}.`,
        variant: 'success',
      });
      setSnoozeTarget(null);
      onTransitioned?.();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: getRelayErrorMessage(error, 'Failed to update incident'),
        variant: 'destructive',
      });
      setSnoozeTarget(null);
    },
  });

  const transition = (target: TransitionTarget, status: InsightStatus) => {
    const variables = { input: { id: target.id } };
    const optimistic = { id: target.id, status, snoozedUntil: null };
    const handlers = feedback(target, status);
    switch (status) {
      case InsightStatus.ACKNOWLEDGED:
        commitAcknowledge({ variables, optimisticResponse: { acknowledgeInsight: optimistic }, ...handlers });
        return;
      case InsightStatus.RESOLVED:
        commitResolve({ variables, optimisticResponse: { resolveInsight: optimistic }, ...handlers });
        return;
      case InsightStatus.ARCHIVED:
        commitArchive({ variables, optimisticResponse: { archiveInsight: optimistic }, ...handlers });
        return;
      case InsightStatus.NEW:
        commitReopen({ variables, optimisticResponse: { reopenInsight: optimistic }, ...handlers });
        return;
      case InsightStatus.SNOOZED:
        setSnoozeTarget(target);
        return;
    }
  };

  const confirmSnooze = (until: Date) => {
    if (!snoozeTarget) return;
    const snoozedUntil = until.toISOString();
    commitSnooze({
      variables: { input: { id: snoozeTarget.id, until: snoozedUntil } },
      optimisticResponse: { snoozeInsight: { id: snoozeTarget.id, status: InsightStatus.SNOOZED, snoozedUntil } },
      ...feedback(snoozeTarget, InsightStatus.SNOOZED),
    });
  };

  return { transition, snoozeTarget, cancelSnooze, confirmSnooze, isMutating, isSnoozing };
}
