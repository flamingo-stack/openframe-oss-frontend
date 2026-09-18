'use client';

import { AssigneeDropdown } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useMutation } from 'react-relay';
import type { assignInsightMutation as AssignInsightMutationType } from '@/__generated__/assignInsightMutation.graphql';
import type { unassignInsightMutation as UnassignInsightMutationType } from '@/__generated__/unassignInsightMutation.graphql';
import { InfoCell } from '@/app/components/shared/info-cell';
import { assignInsightMutation } from '@/graphql/insights/assign-insight-mutation';
import { unassignInsightMutation } from '@/graphql/insights/unassign-insight-mutation';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import { useAssigneeOptions } from '../../tickets/hooks/use-ticket-options';
import type { Incident } from '../utils/incident-transform';

/**
 * The "Assigned" cell of the summary card: the compact assignee picker (the
 * same one the ticket board uses) beside the current holder's name. Assigning
 * is independent of status — an incident can change hands while snoozed.
 */
export function IncidentAssignee({ incident }: { incident: Incident }) {
  const { toast } = useToast();
  const { options, isLoading } = useAssigneeOptions();
  const [commitAssign, isAssigning] = useMutation<AssignInsightMutationType>(assignInsightMutation);
  const [commitUnassign, isUnassigning] = useMutation<UnassignInsightMutationType>(unassignInsightMutation);

  const onError = (error: Error) => {
    toast({
      title: 'Error',
      description: getRelayErrorMessage(error, 'Failed to update the assignee'),
      variant: 'destructive',
    });
  };

  const handleAssign = (userId: string | null) => {
    if (userId === null) {
      commitUnassign({
        variables: { input: { id: incident.id } },
        onCompleted: () => {
          toast({ title: 'Assignee removed', description: `"${incident.title}" is unassigned.`, variant: 'success' });
        },
        onError,
      });
      return;
    }
    const name = options.find(option => option.value === userId)?.label ?? 'a technician';
    commitAssign({
      variables: { input: { id: incident.id, assigneeId: userId } },
      onCompleted: () => {
        toast({
          title: 'Incident assigned',
          description: `"${incident.title}" is now with ${name}.`,
          variant: 'success',
        });
      },
      onError,
    });
  };

  const assignee = incident.assignee;

  return (
    <div className="flex min-w-0 flex-1 items-center gap-[var(--spacing-system-xs)]">
      <AssigneeDropdown
        variant="compact"
        currentAssignee={
          assignee
            ? { id: assignee.id, name: assignee.name, avatarSrc: assignee.avatarUrl, deleted: assignee.deleted }
            : undefined
        }
        options={options}
        isLoading={isLoading}
        isPending={isAssigning || isUnassigning}
        onAssign={handleAssign}
      />
      <InfoCell
        value={
          assignee ? (
            <span className={assignee.deleted ? 'text-ods-error' : undefined}>{assignee.name}</span>
          ) : (
            <span className="text-ods-text-secondary">Unassigned</span>
          )
        }
        label="Assigned"
      />
    </div>
  );
}
