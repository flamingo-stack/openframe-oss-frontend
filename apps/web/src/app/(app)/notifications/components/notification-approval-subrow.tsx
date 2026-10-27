'use client';

import {
  ApprovalBatchMessage,
  approvalMetaToBatchData,
  type ChatApprovalStatus,
  getApprovalMeta,
  type Notification,
  resolutionToStatus,
} from '@flamingo-stack/openframe-frontend-core';
import { useCallback, useMemo, useState } from 'react';
import { useApproveRequest } from '@/app/components/notifications/use-approve-request';

interface NotificationApprovalSubRowProps {
  /** `null` while the list is read: the block draws its own loading form (a typical notification is an approval). */
  notification: Notification | null;
  /** Called after a successful approve/reject (e.g. to mark the notification read). */
  onResolved?: (notificationId: string) => void;
}

/** The expandable approval block for an approval-request notification row: commands + explanation + approve/reject. */
export function NotificationApprovalSubRow({ notification, onResolved }: NotificationApprovalSubRowProps) {
  const approveRequest = useApproveRequest();
  // Optimistic status for this user's own click; backend resolution (below) wins once it arrives.
  const [localStatus, setLocalStatus] = useState<ChatApprovalStatus | null>(null);
  const approval = notification ? getApprovalMeta(notification) : null;
  const resolvedStatus = resolutionToStatus(approval?.resolution);
  const status: ChatApprovalStatus = resolvedStatus !== 'pending' ? resolvedStatus : (localStatus ?? 'pending');

  const batchData = useMemo(() => (approval ? approvalMetaToBatchData(approval) : null), [approval]);

  const decide = useCallback(
    async (approve: boolean) => {
      if (!approval) return;
      setLocalStatus(approve ? 'approved' : 'rejected');
      if (await approveRequest(approval.approvalRequestId, approve)) {
        if (notification) onResolved?.(notification.id);
      } else {
        setLocalStatus(null); // roll back the optimistic flip; the request failed
      }
    },
    [approval, approveRequest, onResolved, notification],
  );

  if (!notification) {
    return (
      <div data-no-row-click className="bg-ods-bg p-0">
        <ApprovalBatchMessage data={null} className="mb-0 rounded-none border-0" />
      </div>
    );
  }
  if (!approval || !batchData) return null;

  return (
    <div data-no-row-click className="bg-ods-bg p-0">
      <ApprovalBatchMessage
        data={batchData}
        status={status}
        resolvedByName={approval.resolvedByName}
        showExecutionStatus={false}
        onApprove={() => decide(true)}
        onReject={() => decide(false)}
        className="mb-0 rounded-none border-0"
      />
    </div>
  );
}
