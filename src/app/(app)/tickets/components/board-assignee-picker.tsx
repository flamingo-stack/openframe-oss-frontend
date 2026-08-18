'use client';

import type { BoardTicket } from '@flamingo-stack/openframe-frontend-core/components/features';
import { AssigneeDropdown } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useUserStatusMap } from '@/app/hooks/use-user-status-map';
import { getFullImageUrl } from '@/lib/image-url';
import { useAssignTicket } from '../hooks/use-assign-ticket';
import { useAssigneeOptions } from '../hooks/use-ticket-options';

interface BoardAssigneePickerProps {
  ticket: BoardTicket;
}

export function BoardAssigneePicker({ ticket }: BoardAssigneePickerProps) {
  const { options, isLoading } = useAssigneeOptions();
  const assign = useAssignTicket();
  const { isUserDeleted } = useUserStatusMap();
  const assignee = ticket.assignees?.[0];

  return (
    <AssigneeDropdown
      variant="compact"
      currentAssignee={
        assignee
          ? {
              id: assignee.id,
              name: assignee.name ?? assignee.initials ?? assignee.id,
              avatarSrc: getFullImageUrl(assignee.avatarUrl),
              deleted: assignee.deleted || isUserDeleted(assignee.id),
            }
          : undefined
      }
      options={options}
      isLoading={isLoading}
      isPending={assign.isPending}
      onAssign={userId => assign.mutate({ ticketId: ticket.id, assigneeId: userId })}
    />
  );
}
