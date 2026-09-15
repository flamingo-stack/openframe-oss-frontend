'use client';

import { Skeleton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { formatCurrency } from '../../lib/format';
import type { SelectionTotal } from '../types/subscription.types';

interface PlanTotalSummaryProps {
  /** Priced device selection; null while nothing priceable is selected. */
  total: SelectionTotal | null;
  /**
   * The AI top-up riding on this checkout, in whole dollars — charged on the
   * checkout's own invoice, so it is due today whatever the devices are.
   * `null` when the plan has no AI product or nothing is chosen yet.
   */
  topUpUsd: number | null;
  /** Whether the AI add-on is part of this plan, and therefore worth explaining. */
  showAiNote: boolean;
  /** Catalog still loading: hold the total's line instead of letting the row appear late. */
  loading?: boolean;
  className?: string;
}

/**
 * What the selection costs, next to the submit button.
 *
 * The label is deliberately not fixed: a prepaid year IS charged at checkout, a
 * pay-as-you-go month is metered and invoiced afterwards, and calling the latter
 * "due today" would be a bill the user never gets. The top-up is the exception
 * that IS due today on either plan — so on a prepaid year it joins the total,
 * and on a metered month it gets a line of its own rather than being folded
 * into an estimate it is not part of.
 */
export function PlanTotalSummary({ total, topUpUsd, showAiNote, loading = false, className }: PlanTotalSummaryProps) {
  const topUp = topUpUsd != null && topUpUsd > 0 ? topUpUsd : 0;

  return (
    <div className={cn('flex flex-col text-ods-text-secondary text-h4', className)}>
      {showAiNote && <p>Devices and AI balance are billed together at checkout.</p>}
      {loading && <Skeleton className="mt-1 h-5 w-56" />}
      {total && total.prepaid && (
        <p>
          Total due today: <span className="text-ods-text-primary text-h3">{formatCurrency(total.amount + topUp)}</span>
        </p>
      )}
      {total && !total.prepaid && (
        <p>
          Estimated total:{' '}
          <span className="text-ods-text-primary text-h3">
            {formatCurrency(total.amount)} / {total.period}
          </span>
        </p>
      )}
      {total && !total.prepaid && topUp > 0 && (
        <p>
          AI balance due today: <span className="text-ods-text-primary text-h3">{formatCurrency(topUp)}</span>
        </p>
      )}
    </div>
  );
}
