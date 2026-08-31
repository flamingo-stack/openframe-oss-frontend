import { TICKET_STATUS_KIND } from './ticket-statistics';

// Mirrors the server rule (TicketTransitionPolicyValidator): a Tech Required
// ticket with a pending tool-approval request cannot change status until the
// approval is resolved. `pendingApproval` already excludes escalate-to-human
// offers on the backend, so its presence matches the lock semantics exactly.
export const STATUS_LOCKED_BY_APPROVAL_REASON = 'Status is locked while an approval request is pending.';

export function isStatusLockedByPendingApproval(
  ticket: { statusKind?: string; pendingApproval?: unknown } | null | undefined,
): boolean {
  return !!ticket && ticket.statusKind === TICKET_STATUS_KIND.TECH_REQUIRED && !!ticket.pendingApproval;
}
