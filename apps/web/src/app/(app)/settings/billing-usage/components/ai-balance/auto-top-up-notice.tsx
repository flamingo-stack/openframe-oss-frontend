'use client';

import { AlertTriangleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { formatCurrency } from '@/lib/format-currency';
import { formatDateTime } from '@/lib/format-date';
import type { AutoTopUpStatus } from './auto-top-up-status';

interface AutoTopUpNoticeProps {
  status: AutoTopUpStatus;
  /** Opens Manage AI Balance; `null` on a build that changes nothing. */
  onManage: (() => void) | null;
}

/**
 * Why the balance stopped refilling itself, under the balance it stopped
 * refilling — the only other place the tenant would learn it is the silence of
 * an assistant that stopped answering once that balance ran dry. Two reasons:
 *  - the system switched auto top-up off: the card declined an automatic
 *    charge, and one charge is one outcome — it is never retried;
 *  - the spend limit holds refills back: auto top-up stays on, and the next
 *    refill is tried at `resumesAt`.
 */
export function AutoTopUpNotice({ status, onManage }: AutoTopUpNoticeProps) {
  if (status.paymentFailed) {
    return (
      <div className="flex flex-wrap items-center gap-[var(--spacing-system-m)] rounded-md border border-ods-warning bg-ods-card p-[var(--spacing-system-m)]">
        <AlertTriangleIcon className="size-6 shrink-0 text-ods-warning" />
        <div className="flex min-w-[16rem] flex-1 flex-col">
          <p className="font-bold text-ods-text-primary text-h3">Auto top-up is switched off.</p>
          <p className="text-ods-text-secondary text-h4">
            The last automatic charge was declined, so your balance no longer refills itself. Update your card in the
            Customer Portal, then turn auto top-up back on.
          </p>
        </div>
        {onManage && (
          <Button variant="outline" onClick={onManage}>
            Manage AI Balance
          </Button>
        )}
      </div>
    );
  }

  if (status.paused) {
    return (
      <div className="flex items-center gap-[var(--spacing-system-m)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-m)]">
        <AlertTriangleIcon className="size-6 shrink-0 text-ods-warning" />
        <div className="flex min-w-0 flex-col">
          <p className="font-bold text-ods-text-primary text-h3">Auto top-up paused</p>
          <p className="text-ods-text-secondary text-h4">
            {spendLimitReachedSentence(status)}
            {resumeSentence(status)}
            {onManage ? ' Raise the limit in Manage AI Balance to resume sooner.' : ''}
          </p>
        </div>
      </div>
    );
  }

  return null;
}

/** "You've reached your $200.00 spend limit for the last 30 days." — said the same on the page and in the modal. */
export function spendLimitReachedSentence(status: AutoTopUpStatus): string {
  return status.spendLimitUsd == null
    ? "You've reached your spend limit for the last 30 days."
    : `You've reached your ${formatCurrency(status.spendLimitUsd)} spend limit for the last 30 days.`;
}

/** When the next refill is tried, if the backend said. */
export function resumeSentence(status: AutoTopUpStatus): string {
  return status.resumesAt ? ` Auto top-ups resume on ${formatDateTime(status.resumesAt)}.` : '';
}
