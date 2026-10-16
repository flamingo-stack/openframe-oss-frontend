'use client';

import { useOptionalNotifications } from '@flamingo-stack/openframe-frontend-core/components/features';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useMingoMessagesStore } from '@/app/(app)/mingo/stores/mingo-messages-store';
import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';
import { useApproveRequest } from '@/app/components/notifications/use-approve-request';
import { type ApprovalDecision, settleApprovalCaches } from './approval-decisions';
import { type ApprovalCard, decidedCard } from './approval-inbox';

export interface ApprovalDecider {
  /** Cards decided here, kept on screen with their decision until the page is left. */
  kept: Readonly<Record<string, ApprovalCard>>;
  /** The tile's Approve / Reject. Throws on failure, which is how the tile rolls its status back. */
  decide: (card: ApprovalCard, approve: boolean) => Promise<void>;
  /** The tile's ✓, also called by the tile after a decision succeeded. */
  complete: (card: ApprovalCard) => void;
}

/**
 * Deciding from the Needs approval page, through the same mutation (and the same toasts)
 * as the notification drawer, which makes the decision reach every other surface:
 * - this page and the sidebar badge: the mutation records it (`noteApprovalDecision`);
 * - the drawer: the request's notifications are completed, as the drawer's own decision
 *   completes its tile (the tile reports success through `complete`);
 * - the tickets board and the chat list: their caches drop the request
 *   (`settleApprovalCaches`);
 * - the Mingo chat: a thread the session holds flips its approval card, as the chat's own
 *   Approve does. The open chat's stream also says so; a thread not loaded reads it from
 *   its history when it opens.
 */
export function useApprovalDecider(): ApprovalDecider {
  const queryClient = useQueryClient();
  const approveRequest = useApproveRequest();
  const notifications = useOptionalNotifications();
  const user = useAuthStore(state => state.user);
  const [kept, setKept] = useState<Readonly<Record<string, ApprovalCard>>>({});

  const decide = async (card: ApprovalCard, approve: boolean) => {
    if (!(await approveRequest(card.approvalRequestId, approve))) throw new Error('approval request failed');
    const decision: ApprovalDecision = approve ? 'approved' : 'rejected';
    const resolvedByName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || null;
    settleApprovalCaches(queryClient, card.approvalRequestId);
    if (card.dialogId) {
      const messages = useMingoMessagesStore.getState();
      if (messages.messagesByDialog.has(card.dialogId)) {
        messages.updateApprovalStatusInMessages(card.dialogId, card.approvalRequestId, decision, resolvedByName);
      }
    }
    setKept(previous => ({ ...previous, [card.approvalRequestId]: decidedCard(card, decision, resolvedByName) }));
  };

  const complete = (card: ApprovalCard) => {
    if (!notifications) return;
    for (const notification of notifications.notifications) {
      if (!notification.read && notification.meta?.approvalRequestId === card.approvalRequestId) {
        notifications.markRead(notification.id);
      }
    }
  };

  return { kept, decide, complete };
}
