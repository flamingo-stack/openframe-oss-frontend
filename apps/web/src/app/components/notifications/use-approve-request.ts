'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useCallback } from 'react';
import { ticketService } from '@/app/(app)/tickets/services';
import { noteApprovalSettled } from '@/app/components/approvals/approval-decisions';

/**
 * - `decided`: the server took this decision.
 * - `settled`: the server refused because the request no longer waits (resolved elsewhere,
 *   expired, gone), so no click can ever decide it: callers drop it as they drop a decided one.
 * - `failed`: anything else; the request still waits.
 */
export type ApprovalOutcome = 'decided' | 'settled' | 'failed';

/**
 * How the ai-agent words a refusal for a request that no longer waits. Its `userErrors`
 * carry no code, so the message is all there is to go on.
 */
const SETTLED_REFUSAL = /already|expired|no longer|not pending|not found|does ?n[o']t exist/i;

export function isSettledRefusal(message: string): boolean {
  return SETTLED_REFUSAL.test(message);
}

/**
 * One request per approval, whatever surfaces and clicks ask for it: a second click (the
 * popup's and the page's tile of one request) gets the first one's answer, and one toast.
 */
const inFlight = new Map<string, Promise<ApprovalOutcome>>();

/**
 * Approve or reject a Mingo tool-approval request. Toasts the outcome and returns it so
 * callers can decide their own follow-up (mark read, flip status, keep pending).
 */
export function useApproveRequest() {
  const { toast } = useToast();

  return useCallback(
    (approvalRequestId: string, approve: boolean): Promise<ApprovalOutcome> => {
      const pending = inFlight.get(approvalRequestId);
      if (pending) return pending;

      const request = (async (): Promise<ApprovalOutcome> => {
        try {
          await ticketService.resolveApprovalRequest(approvalRequestId, approve);
        } catch (error) {
          const message = error instanceof Error ? error.message : '';
          if (message && isSettledRefusal(message)) {
            noteApprovalSettled(approvalRequestId);
            toast({ title: 'No longer pending', description: message, variant: 'info' });
            return 'settled';
          }
          toast({
            title: 'Error',
            description: message || `Failed to ${approve ? 'approve' : 'reject'} request`,
            variant: 'destructive',
          });
          return 'failed';
        } finally {
          inFlight.delete(approvalRequestId);
        }
        toast({
          title: approve ? 'Approved' : 'Rejected',
          description: `Request ${approve ? 'approved' : 'rejected'}.`,
          variant: 'success',
        });
        return 'decided';
      })();
      inFlight.set(approvalRequestId, request);
      return request;
    },
    [toast],
  );
}
