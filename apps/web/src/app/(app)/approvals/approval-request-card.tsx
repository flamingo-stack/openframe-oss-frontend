'use client';

import { ApprovalRequestNotificationTile } from '@flamingo-stack/openframe-frontend-core/components/features';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { MouseEvent, ReactNode } from 'react';
import type { ApprovalCard } from '@/app/components/approvals/approval-inbox';
import {
  type NotificationAction,
  resolveNotificationAction,
} from '@/app/components/notifications/notification-navigation';
import { openMingoDialog } from '@/app/components/notifications/open-mingo-dialog';

interface ApprovalRequestCardProps {
  card: ApprovalCard;
  onDecide: (card: ApprovalCard, approve: boolean) => Promise<void>;
  onComplete: (card: ApprovalCard) => void;
}

/**
 * One approval on the Needs approval page: the lib's approval tile (Approve / Reject, the
 * decision tag once decided, the expandable commands), with its title linking to what the
 * request belongs to — the ticket, or the Mingo chat through the dialog-open seam — by the
 * same mapping a notification tile follows.
 */
export function ApprovalRequestCard({ card, onDecide, onComplete }: ApprovalRequestCardProps) {
  const action = resolveNotificationAction(card.notification);
  const { title } = card.notification;
  const notification = action
    ? { ...card.notification, title: <EntityTitleLink action={action}>{title}</EntityTitleLink> }
    : card.notification;

  return (
    <ApprovalRequestNotificationTile
      notification={notification}
      onApprove={() => onDecide(card, true)}
      onReject={() => onDecide(card, false)}
      onComplete={() => onComplete(card)}
    />
  );
}

function isPlainClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

/**
 * A real link (new tab, copy link address) to the entity's canonical route. A plain click
 * on a chat goes through `openMingoDialog`, the one way the app opens a conversation.
 */
function EntityTitleLink({ action, children }: { action: NotificationAction; children: ReactNode }) {
  const router = useRouter();
  const { mingoDialogId } = action;

  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!mingoDialogId || event.defaultPrevented || !isPlainClick(event)) return;
    event.preventDefault();
    openMingoDialog(mingoDialogId, { navigate: router.push });
  };

  return (
    <Link
      href={action.route}
      onClick={onClick}
      title={typeof children === 'string' ? children : undefined}
      className="rounded-sm transition-colors hover:text-ods-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-accent"
    >
      {children}
    </Link>
  );
}
