'use client';

import type { BoardTicket } from '@flamingo-stack/openframe-frontend-core/components/features';
import { UserPlusIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { AssigneeDropdown, SquareAvatar } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useUserStatusMap } from '@/app/hooks/use-user-status-map';
import { getFullImageUrl } from '@/lib/image-url';
import { useAssignTicket } from '../hooks/use-assign-ticket';
import { useAssigneeOptions } from '../hooks/use-ticket-options';

interface BoardAssigneePickerProps {
  ticket: BoardTicket;
  /** When set, the ticket is still AI-worked: clicking opens the Take Over modal instead of the assignee dropdown. */
  onTakeOver?: () => void;
}

export function BoardAssigneePicker({ ticket, onTakeOver }: BoardAssigneePickerProps) {
  const { options, isLoading } = useAssigneeOptions();
  const assign = useAssignTicket();
  const { isUserDeleted } = useUserStatusMap();
  const assignee = ticket.assignees?.[0];

  // AI-worked ticket: same trigger visuals as the compact dropdown, but the
  // click starts the Take Over confirmation flow instead of a plain assign.
  if (onTakeOver) {
    return assignee ? (
      <button
        type="button"
        aria-label="Take over ticket"
        onClick={event => {
          event.preventDefault();
          event.stopPropagation();
          onTakeOver();
        }}
        className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-focus"
      >
        <SquareAvatar
          src={getFullImageUrl(assignee.avatarUrl)}
          alt={assignee.name ?? assignee.id}
          fallback={assignee.name ?? assignee.initials ?? assignee.id}
          size="sm"
          variant="round"
        />
      </button>
    ) : (
      <button
        type="button"
        aria-label="Take over ticket"
        onClick={event => {
          event.preventDefault();
          event.stopPropagation();
          onTakeOver();
        }}
        className="size-8 rounded-full border border-ods-border flex items-center justify-center shrink-0 text-ods-text-secondary hover:text-ods-accent hover:border-ods-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-focus"
      >
        <UserPlusIcon className="size-4" />
      </button>
    );
  }

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
