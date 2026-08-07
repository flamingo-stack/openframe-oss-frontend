'use client';

import { Autocomplete, Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import { SimpleModal } from '@/app/components/shared/simple-modal';
import { EVENT_SUBTYPE, trackDashboardActivity } from '@/lib/analytics';
import { useAuthStore } from '@/stores';
import { useTakeOverTicket } from '../hooks/use-take-over-ticket';
import { useSelfFirstAssigneeOptions } from '../hooks/use-ticket-options';
import { useTicketStatusesQuery } from '../statuses/hooks/use-ticket-statuses-query';
import type { Dialog } from '../types/dialog.types';
import { isResolvedStatusId } from '../utils/is-resolved-status';
import { avatarStartAdornment, renderAvatarOption } from './avatar-autocomplete';
import { renderStatusOption, type StatusOption, statusStartAdornment } from './status-autocomplete';

const renderAssigneeOption = renderAvatarOption('round');

/**
 * What the modal needs to know about the ticket being taken over, plus
 * trigger-specific prefills (the status the user dragged/picked, the assignee
 * they clicked). Built from the ticket's `Dialog` at each trigger site.
 */
export interface TakeOverTicketTarget {
  ticket: Pick<
    Dialog,
    'id' | 'ticketNumber' | 'title' | 'dialogId' | 'assignedTo' | 'availableTransitions' | 'currentMode'
  >;
  /** Pre-selected status (e.g. the transition the user just picked); defaults to the first custom status. */
  initialStatusId?: string;
  /** Pre-selected assignee (e.g. the user picked in an assign dropdown); defaults to the ticket's current assignee, then the signed-in user. */
  initialAssigneeId?: string;
}

interface TakeOverTicketModalProps {
  /** Non-null opens the modal. */
  target: TakeOverTicketTarget | null;
  onClose: () => void;
  onSuccess?: () => void;
}

/**
 * Take Over Ticket confirmation (Figma 8482-112154 / 8482-112169): shown
 * instead of one-click status/assign changes when a ticket is still being
 * worked by the AI assistant. Confirming moves the ticket to the selected
 * status, assigns the technician, and switches the client chat to direct mode.
 */
export function TakeOverTicketModal({ target, onClose, onSuccess }: TakeOverTicketModalProps) {
  // Keep rendering the last target while the close animation plays.
  const lastTargetRef = useRef<TakeOverTicketTarget | null>(null);
  if (target) lastTargetRef.current = target;
  const shown = target ?? lastTargetRef.current;
  const ticket = shown?.ticket;

  const currentUserId = useAuthStore(state => state.user?.id);
  const assigneeOptions = useSelfFirstAssigneeOptions();
  const { data: statusesData } = useTicketStatusesQuery();
  const takeOver = useTakeOverTicket();

  // Allowed target statuses, custom statuses first (each group in board
  // order) — the design pre-selects the first custom status by default.
  const statusOptions = useMemo<StatusOption[]>(() => {
    const transitions = ticket?.availableTransitions ?? [];
    const snapshot = statusesData?.snapshot;
    const toOption = (t: { id: string; name: string; color: string }): StatusOption => ({
      label: t.name,
      value: t.id,
      color: t.color,
    });
    if (!snapshot) return transitions.map(toOption);
    const order = new Map(snapshot.map((s, index) => [s.id, { isSystem: s.isSystem, index }]));
    return [...transitions]
      .sort((a, b) => {
        const metaA = order.get(a.id);
        const metaB = order.get(b.id);
        if ((metaA?.isSystem ? 1 : 0) !== (metaB?.isSystem ? 1 : 0)) return metaA?.isSystem ? 1 : -1;
        return (metaA?.index ?? 0) - (metaB?.index ?? 0);
      })
      .map(toOption);
  }, [ticket?.availableTransitions, statusesData]);

  const [statusId, setStatusId] = useState<string | null>(null);
  const [assigneeId, setAssigneeId] = useState<string | null>(null);

  // Re-seed the selections every time the modal opens for a (possibly new) target.
  useEffect(() => {
    if (!target) return;
    setStatusId(target.initialStatusId ?? null);
    setAssigneeId(target.initialAssigneeId ?? target.ticket.assignedTo ?? currentUserId ?? null);
  }, [target, currentUserId]);

  const selectedStatusId = statusId ?? statusOptions[0]?.value ?? null;
  const selectedStatus = statusOptions.find(o => o.value === selectedStatusId);
  const selectedAssignee = assigneeOptions.options.find(o => o.value === assigneeId);

  const handleConfirm = () => {
    if (!ticket || !selectedStatusId || !assigneeId || takeOver.isPending) return;
    // Same optimistic resolve tracking as the inline status changer (see
    // ticket-details-view handleTransition).
    if (isResolvedStatusId(selectedStatusId, statusesData?.snapshot)) {
      trackDashboardActivity(EVENT_SUBTYPE.RESOLVE_TICKET);
    }
    takeOver.mutate(
      { ticketId: ticket.id, dialogId: ticket.dialogId, toStatusId: selectedStatusId, assigneeId },
      {
        onSuccess: () => {
          onClose();
          onSuccess?.();
        },
      },
    );
  };

  const ticketRef = ticket ? [ticket.ticketNumber, ticket.title].filter(Boolean).join(': ') : '';

  return (
    <SimpleModal
      isOpen={target !== null}
      onClose={takeOver.isPending ? () => {} : onClose}
      title="Take Over Ticket"
      className="text-left md:max-w-[600px]"
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={takeOver.isPending}
            className="flex-1 md:hidden"
          >
            Cancel
          </Button>
          <div className="hidden md:block flex-1" />
          <Button
            type="button"
            variant="accent"
            onClick={handleConfirm}
            loading={takeOver.isPending}
            disabled={!selectedStatusId || !assigneeId}
            className="flex-1"
          >
            Take Over
          </Button>
        </>
      }
    >
      <p className="text-h4 text-ods-text-primary">
        The ticket <span className="text-ods-accent">{ticketRef}</span> will move to the selected status and be assigned
        to the technician. A direct chat with the user will start, and the AI assistant will stop working on this
        ticket.
      </p>

      <div className="flex flex-col md:flex-row gap-[var(--spacing-system-l)] w-full">
        <div className="flex-1 min-w-0">
          <Autocomplete
            label="Status"
            options={statusOptions}
            value={selectedStatusId}
            onChange={setStatusId}
            placeholder="Select Status"
            startAdornment={statusStartAdornment(selectedStatus)}
            renderOption={renderStatusOption}
          />
        </div>
        <div className="flex-1 min-w-0">
          <Autocomplete
            label="Assigned"
            options={assigneeOptions.options}
            value={assigneeId}
            onChange={setAssigneeId}
            placeholder="Select Technician"
            loading={assigneeOptions.isLoading}
            startAdornment={avatarStartAdornment(selectedAssignee, 'round')}
            renderOption={renderAssigneeOption}
          />
        </div>
      </div>
    </SimpleModal>
  );
}
