'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { ErrorBoundary } from '@flamingo-stack/openframe-frontend-core/components/features';
import { AlertTriangleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import {
  type BillingNotice,
  findNotice,
  useBillingNotices,
} from '@/app/components/billing-notices/use-billing-notices';
import { BillingNoticeSeverity, BillingNoticeType, SubscriptionStatus } from '@/generated/schema-enums';
import { formatCurrency } from '@/lib/format-currency';
import { formatDate } from '@/lib/format-date';

type DebtStatus = typeof SubscriptionStatus.PAST_DUE | typeof SubscriptionStatus.SUSPENDED;

/** The notice each debt screen states: the overdue screen counts to the suspension, the suspended one to deletion. */
const NOTICE_FOR: Record<DebtStatus, BillingNoticeType> = {
  [SubscriptionStatus.PAST_DUE]: BillingNoticeType.PAYMENT_OVERDUE,
  [SubscriptionStatus.SUSPENDED]: BillingNoticeType.ACCOUNT_SUSPENDED,
};

/** What the block says, from the figures the notice carries — the same ones the billing email states. */
function deadlineCopy(notice: BillingNotice): { title: string; description: string } | null {
  if (notice.type === BillingNoticeType.PAYMENT_OVERDUE && notice.suspensionDate) {
    return {
      title: notice.amountDue != null ? `${formatCurrency(notice.amountDue)} is overdue.` : 'An invoice is overdue.',
      description: `Unless it's paid, the workspace is suspended on ${formatDate(notice.suspensionDate)} and your agents stop too.`,
    };
  }
  if (notice.type === BillingNoticeType.ACCOUNT_SUSPENDED && notice.deletionDate) {
    return {
      title: `The workspace is deleted on ${formatDate(notice.deletionDate)}.`,
      description: 'Pay the outstanding balance before then to keep its data.',
    };
  }
  return null;
}

interface BillingDeadlineNoticeProps {
  status: DebtStatus;
  /** The viewer's role is still being read: an amount owed is not shown to someone who may turn out not to see it. */
  gated: boolean;
}

/**
 * The date the debt screens count to, and on the overdue one the amount: the
 * backend's PAYMENT_OVERDUE and ACCOUNT_SUSPENDED notices. Neither can be
 * dismissed; each goes when its condition does. Red in the last seven days
 * (CRITICAL), amber before.
 *
 * Optional: absent while it loads, when the notice does not hold, and while the
 * backend's notifications flag is off (the list is empty) — the screen is then
 * exactly what it was without it. A failure to load costs the block only.
 */
export function BillingDeadlineNotice(props: BillingDeadlineNoticeProps) {
  return (
    <ErrorBoundary fallback={null}>
      <DeadlineNotice {...props} />
    </ErrorBoundary>
  );
}

function DeadlineNotice({ status, gated }: BillingDeadlineNoticeProps) {
  return (
    <LoadingSuspense gated={gated} label="Loading billing notice">
      <DeadlineNoticeReader status={status} />
    </LoadingSuspense>
  );
}

/** In its scope it draws nothing and reads nothing: a placeholder would be a box that vanishes wherever the notice does not hold. */
function DeadlineNoticeReader({ status }: { status: DebtStatus }) {
  if (useLoadingScope()) return null;
  return <BillingDeadlineNoticeQuery status={status} />;
}

function BillingDeadlineNoticeQuery({ status }: { status: DebtStatus }) {
  const notice = findNotice(useBillingNotices(), NOTICE_FOR[status]);
  const copy = notice ? deadlineCopy(notice) : null;
  if (!notice || !copy) return null;

  return (
    <div className="flex w-full max-w-[960px] items-center gap-[var(--spacing-system-m)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-m)]">
      <AlertTriangleIcon
        className={cn(
          'size-6 shrink-0',
          notice.severity === BillingNoticeSeverity.CRITICAL ? 'text-ods-error' : 'text-ods-warning',
        )}
      />
      <div className="flex min-w-0 flex-col">
        <p className="font-bold text-ods-text-primary text-h3">{copy.title}</p>
        <p className="text-ods-text-secondary text-h4">{copy.description}</p>
      </div>
    </div>
  );
}
