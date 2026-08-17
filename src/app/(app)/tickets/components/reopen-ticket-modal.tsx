'use client';

import {
  ReopenTicketModal as ReopenTicketModalView,
  type TakeOverStatusOption,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useMemo } from 'react';
import { useReopenTicket } from '../hooks/use-reopen-ticket';
import { useTicketDetail } from '../hooks/use-ticket-detail';
import { useAssigneeOptions } from '../hooks/use-ticket-options';
import { useTicketStatusesQuery } from '../statuses/hooks/use-ticket-statuses-query';
import { TICKET_STATUS_KIND } from '../utils/ticket-statistics';

/**
 * What identifies the ticket being reopened, plus the trigger-specific prefill
 * (the status the user dragged/picked). The ticket itself is read from the
 * detail cache — the board's card model doesn't carry `availableTransitions`,
 * and the details page has the same query warm already.
 */
export interface ReopenTicketTarget {
  ticketId: string;
  /** Pre-selected status (e.g. the transition the user just picked or the lane
   *  they dropped into); defaults to the first TECH_REQUIRED-kind transition
   *  (design annotation: "tech required by default"). */
  initialStatusId?: string;
}

interface ReopenTicketModalProps {
  /** Non-null opens the modal. */
  target: ReopenTicketTarget | null;
  onClose: () => void;
  onSuccess?: () => void;
}

/**
 * Reopen Ticket confirmation (Figma openframe---tickets 8456-17581): shown
 * instead of a one-click status change when the ticket sits in a terminal
 * status (Resolved/Archived). Confirming reopens the ticket via
 * `requestTicketReopen` (which fires the chat card + reopen notification),
 * moves it to the selected status, and re-assigns when changed — see
 * `useReopenTicket` for the composite.
 */
export function ReopenTicketModal({ target, onClose, onSuccess }: ReopenTicketModalProps) {
  const { ticket } = useTicketDetail(target?.ticketId);
  const assigneeOptions = useAssigneeOptions(target !== null);
  const { data: statusesData } = useTicketStatusesQuery();
  const reopen = useReopenTicket();

  const kindById = useMemo(() => {
    const map = new Map<string, string>();
    for (const status of statusesData?.snapshot ?? []) {
      if (status.kind) map.set(status.id, status.kind);
    }
    return map;
  }, [statusesData]);

  // Valid reopen targets only: closed kinds (Resolved/Archived) are not
  // statuses a ticket can reopen INTO, whatever the transition graph says.
  const statusOptions = useMemo<TakeOverStatusOption[]>(() => {
    return (ticket?.availableTransitions ?? [])
      .filter(t => {
        const kind = kindById.get(t.id);
        return kind !== TICKET_STATUS_KIND.RESOLVED && kind !== TICKET_STATUS_KIND.ARCHIVED;
      })
      .map(t => ({ label: t.name, value: t.id, color: t.color }));
  }, [ticket?.availableTransitions, kindById]);

  // Design default: Tech Required, unless the trigger already picked a status.
  const initialStatusId = useMemo(() => {
    if (target?.initialStatusId) return target.initialStatusId;
    return statusOptions.find(o => kindById.get(o.value) === TICKET_STATUS_KIND.TECH_REQUIRED)?.value ?? null;
  }, [target?.initialStatusId, statusOptions, kindById]);

  const ticketRef = ticket ? [ticket.ticketNumber, ticket.title].filter(Boolean).join(': ') : '';

  return (
    <ReopenTicketModalView
      isOpen={target !== null}
      onClose={onClose}
      ticketRef={ticketRef}
      statusOptions={statusOptions}
      assigneeOptions={assigneeOptions.options.map(o => ({ label: o.label, value: o.value, imageUrl: o.imageUrl }))}
      assigneesLoading={assigneeOptions.isLoading}
      initialStatusId={initialStatusId}
      // Design default: restore the previous assignee. Both Status and
      // Assigned are required — with no assignee the CTA stays locked.
      initialAssigneeId={ticket?.assignedTo ?? null}
      isPending={reopen.isPending}
      onConfirm={selection => {
        if (!target || !ticket) return;
        reopen.mutate(
          {
            ticketId: target.ticketId,
            toStatusId: selection.statusId,
            toStatusKind: kindById.get(selection.statusId),
            assigneeId: selection.assigneeId,
            currentAssigneeId: ticket.assignedTo ?? null,
            reason: selection.reason,
          },
          {
            onSuccess: () => {
              onClose();
              onSuccess?.();
            },
          },
        );
      }}
    />
  );
}
