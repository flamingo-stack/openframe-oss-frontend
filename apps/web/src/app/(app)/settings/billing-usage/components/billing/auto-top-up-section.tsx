'use client';

import { formatCurrency } from '@/lib/format-currency';
import { formatDateTime } from '@/lib/format-date';
import { type AutoTopUpStatus, spendLimitUsage } from '../ai-balance/auto-top-up-status';
import { SpendLimitBar } from '../ai-balance/spend-limit-bar';
import { BillingRow, SectionBlock } from '../shared/billing-section';

/** The secondary half of a row's value: what the figure before it means. */
function Trailing({ children }: { children: string }) {
  return <span className="text-ods-text-secondary"> / {children}</span>;
}

/**
 * The standing refill arrangement while it is on: its state, the balance that
 * triggers a refill, what one refill charges, and how much of the spend limit
 * the last 30 days have used. Figures only — every change is made in Manage AI
 * Balance, so the read-only build shows the same section.
 *
 * Nothing while it is off: the Paid AI Tokens card's mark is gone then, and a
 * section of figures that are not in effect would say the opposite.
 */
export function AutoTopUpSection({ status }: { status: AutoTopUpStatus }) {
  if (!status.enabled) return null;

  const usage = spendLimitUsage(status.spentUsd, status.spendLimitUsd);

  return (
    <SectionBlock title="Auto Top-up">
      <BillingRow
        label="Status"
        value={
          status.paused ? (
            <>
              Paused
              {status.resumesAt && <Trailing>{`resumes ${formatDateTime(status.resumesAt)}`}</Trailing>}
            </>
          ) : (
            'On'
          )
        }
      />
      {status.thresholdUsd != null && (
        <BillingRow
          label="Threshold"
          value={
            <>
              {formatCurrency(status.thresholdUsd)}
              <Trailing>refill when balance drops below</Trailing>
            </>
          }
        />
      )}
      {status.amountUsd != null && (
        <BillingRow
          label="Top-up Amount"
          value={
            <>
              {formatCurrency(status.amountUsd)}
              <Trailing>per top-up</Trailing>
            </>
          }
        />
      )}
      <BillingRow
        label="Spend Limit"
        value={
          status.spendLimitUsd == null ? (
            <>
              No limit
              <Trailing>{`${formatCurrency(status.spentUsd)} in the last 30 days`}</Trailing>
            </>
          ) : (
            <>
              <span className={usage?.reached ? 'text-ods-error' : undefined}>{formatCurrency(status.spentUsd)}</span>
              <Trailing>{formatCurrency(status.spendLimitUsd)}</Trailing>
            </>
          )
        }
      />
      {usage && (
        <SpendLimitBar
          percent={usage.percent}
          reached={usage.reached}
          label="Auto top-up spend over the last 30 days"
        />
      )}
    </SectionBlock>
  );
}
