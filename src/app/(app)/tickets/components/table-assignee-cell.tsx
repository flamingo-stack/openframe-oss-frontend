'use client';

import { UserPlusIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  SearchableSelect,
  type SearchableSelectOption,
  SquareAvatar,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { memo, useMemo } from 'react';
import { useAssignTicket } from '../hooks/use-assign-ticket';
import { useAssigneeOptions } from '../hooks/use-ticket-options';

interface UnassignedTicketCellProps {
  ticketId: string;
  /**
   * Offers the assign dropdown. Off for archived rows and for tickets the AI
   * is still working — there assignment is a take-over and stays on the details
   * page, which runs that flow.
   */
  interactive: boolean;
}

/** The ghost avatar + "Unassigned" label the mock puts in the ASSIGNED column. */
function UnassignedFace({ interactive }: { interactive?: boolean }) {
  return (
    <>
      <span
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-full border border-ods-border text-ods-text-secondary',
          interactive && 'transition-colors group-hover:border-ods-accent group-hover:text-ods-accent',
        )}
      >
        <UserPlusIcon className="size-4" />
      </span>
      <span className="truncate text-ods-text-secondary text-h4">Unassigned</span>
    </>
  );
}

/**
 * The ASSIGNED cell for a ticket nobody owns yet: "Unassigned" with the ghost
 * avatar, and (when `interactive`) the same assign dropdown the board card
 * offers — one first assignment from the list. Re-assigning an owned ticket is
 * deliberately NOT offered here; that lives on the ticket details page.
 *
 * Memoized: one per unassigned row, re-rendered on every table update.
 */
export const UnassignedTicketCell = memo(function UnassignedTicketCell({
  ticketId,
  interactive,
}: UnassignedTicketCellProps) {
  // The options list is shared react-query state — fetched once for the table.
  const { options, isLoading } = useAssigneeOptions(interactive);
  const assign = useAssignTicket();

  const selectOptions = useMemo<SearchableSelectOption[]>(
    () =>
      options.map(option => ({
        value: String(option.value),
        label: option.label,
        icon: (
          <SquareAvatar
            src={option.imageUrl}
            alt={option.label}
            fallback={option.label}
            size="sm"
            variant="round"
            className="h-6 w-6 shrink-0"
          />
        ),
      })),
    [options],
  );

  if (!interactive) {
    return (
      <div className="flex min-w-0 items-center gap-2">
        <UnassignedFace />
      </div>
    );
  }

  return (
    // The rows are links; the picker region opts out of row navigation.
    <div data-no-row-click className="pointer-events-auto">
      <SearchableSelect
        options={selectOptions}
        value={null}
        onValueChange={userId => assign.mutate({ ticketId, assigneeId: userId })}
        searchPlaceholder="Search users..."
        emptyText="No users found"
        isLoading={isLoading}
        align="start"
        contentClassName="w-72"
        trigger={
          <button
            type="button"
            aria-label="Assign user"
            className="group flex min-w-0 cursor-pointer items-center gap-2 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-focus"
          >
            <UnassignedFace interactive />
          </button>
        }
      />
    </div>
  );
});
