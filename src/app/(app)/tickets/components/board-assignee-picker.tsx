'use client';

import type { BoardTicket } from '@flamingo-stack/openframe-frontend-core/components/features';
import { AssigneeDropdown } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { memo } from 'react';
import { useUserStatusMap } from '@/app/hooks/use-user-status-map';
import { getFullImageUrl } from '@/lib/image-url';
import { useAssignTicket } from '../hooks/use-assign-ticket';
import { useAssigneeOptions } from '../hooks/use-ticket-options';

interface BoardAssigneePickerProps {
  ticket: BoardTicket;
  /** When set, the ticket is still AI-worked: clicking opens the Take Over modal instead of the assignee dropdown. */
  onTakeOver?: () => void;
}

/** Memoized: this sits in every card, and a board update re-renders the lanes. */
export const BoardAssigneePicker = memo(function BoardAssigneePicker({ ticket, onTakeOver }: BoardAssigneePickerProps) {
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
      // AI-worked ticket: the trigger click starts the Take Over flow instead
      // of opening the dropdown (core renders the plain trigger button).
      onTriggerClick={onTakeOver}
    />
  );
});
