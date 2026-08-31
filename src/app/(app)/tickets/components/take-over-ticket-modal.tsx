'use client';

import {
  TakeOverTicketModal as CoreTakeOverTicketModal,
  type TakeOverStatusOption,
  type TakeOverTicketSelection,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useMemo, useRef } from 'react';
import { EVENT_SUBTYPE, trackDashboardActivity } from '@/lib/analytics';
import { useAuthStore } from '@/stores';
import { useTakeOverTicket } from '../hooks/use-take-over-ticket';
import { useSelfFirstAssigneeOptions } from '../hooks/use-ticket-options';
import { useTicketStatusesQuery } from '../statuses/hooks/use-ticket-statuses-query';
import type { Dialog } from '../types/dialog.types';
import { isResolvedStatusId } from '../utils/is-resolved-status';

/**
 * What the take-over flow needs to know about the ticket, plus trigger-specific
 * prefills (the status the user dragged/picked, the assignee they clicked).
 * Built from the ticket's `Dialog` at each trigger site.
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
  /**
   * Fires with the confirmed selection BEFORE `onClose`, so a host that held
   * UI state for the pending take-over (the board's held drop) can convert it
   * instead of discarding it when the close handler runs.
   */
  onSuccess?: (selection: TakeOverTicketSelection) => void;
}

/**
 * App-side wrapper around the core-lib `TakeOverTicketModal` (presentational):
 * supplies the option lists (allowed transitions, custom statuses first;
 * assignees with the signed-in user first), the default selections, and runs
 * the actual take-over sequence via `useTakeOverTicket` on confirm.
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
  const statusOptions = useMemo<TakeOverStatusOption[]>(() => {
    const transitions = ticket?.availableTransitions ?? [];
    const snapshot = statusesData?.snapshot;
    const toOption = (t: { id: string; name: string; color: string }): TakeOverStatusOption => ({
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

  const handleConfirm = ({ statusId, assigneeId }: TakeOverTicketSelection) => {
    if (!ticket || takeOver.isPending) return;
    // Same optimistic resolve tracking as the inline status changer (see
    // ticket-details-view handleTransition).
    if (isResolvedStatusId(statusId, statusesData?.snapshot)) {
      trackDashboardActivity(EVENT_SUBTYPE.RESOLVE_TICKET);
    }
    takeOver.mutate(
      { ticketId: ticket.id, toStatusId: statusId, assigneeId },
      {
        onSuccess: () => {
          onSuccess?.({ statusId, assigneeId });
          onClose();
        },
      },
    );
  };

  return (
    <CoreTakeOverTicketModal
      isOpen={target !== null}
      onClose={onClose}
      ticketRef={ticket ? [ticket.ticketNumber, ticket.title].filter(Boolean).join(': ') : ''}
      statusOptions={statusOptions}
      assigneeOptions={assigneeOptions.options}
      assigneesLoading={assigneeOptions.isLoading}
      initialStatusId={shown?.initialStatusId ?? null}
      initialAssigneeId={shown?.initialAssigneeId ?? ticket?.assignedTo ?? currentUserId ?? null}
      isPending={takeOver.isPending}
      onConfirm={handleConfirm}
    />
  );
}
