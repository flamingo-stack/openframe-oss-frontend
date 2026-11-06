'use client';

import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { LoadingLine } from '@/app/components/shared/loading-line';
import { formatCurrency } from '@/lib/format-currency';
import { formatDate } from '@/lib/format-date';
import type { DevicePlanMode, SelectionTotal } from './plan-selection';

interface PlanTotalSummaryProps {
  /** How the devices are paid for; `null` until the picker reports (or with no device product). */
  mode: DevicePlanMode | null;
  /** Priced device selection: the prepaid year's figure; null on pay-as-you-go or while nothing priceable is selected. */
  total: SelectionTotal | null;
  /**
   * The AI top-up riding on this checkout, in whole dollars — charged on the
   * checkout's own invoice, so it is due today whatever the devices are.
   * `null` when the plan has no AI product or no top-up is chosen.
   */
  topUpUsd: number | null;
  /** Whether the AI add-on is part of this plan, and therefore worth explaining. */
  showAiNote: boolean;
  /** When a pay-as-you-go month is first invoiced — `PlanCheckout.paygFirstBillingDate`. */
  firstBillingDate: Date;
  /** Catalog still loading: hold the total's lines instead of letting them appear late. */
  loading?: boolean;
  className?: string;
}

/**
 * What the selection costs today, next to the submit button.
 *
 * A prepaid year IS charged at checkout, so it is the total, the top-up on top.
 * A pay-as-you-go month is metered and invoiced afterwards: what is due today is
 * the top-up alone, and the line beside it names the day the devices are billed
 * on — never an estimate of a bill nobody has been sent.
 */
export function PlanTotalSummary({
  mode,
  total,
  topUpUsd,
  showAiNote,
  firstBillingDate,
  loading = false,
  className,
}: PlanTotalSummaryProps) {
  const isLoading = useLoadingScope() || loading;
  const topUp = topUpUsd != null && topUpUsd > 0 ? topUpUsd : 0;

  const dueToday = (amount: number, note?: string) => (
    <p>
      Total due today: <span className="text-ods-text-primary text-h3">{formatCurrency(amount)}</span>
      {note}
    </p>
  );

  return (
    <div className={cn('flex flex-col text-ods-text-secondary text-h4', className)}>
      {/* While loading the picker shows pay-as-you-go, so the summary holds that one's two lines: the figure in h3,
          the billing day in h4. */}
      {isLoading ? (
        <>
          <LoadingLine type="h3" className="w-56" />
          <LoadingLine type="h4" className="w-64" />
        </>
      ) : mode === 'ANNUAL' ? (
        <>
          {showAiNote && <p>Devices and AI balance are billed together at checkout.</p>}
          {total && dueToday(total.amount + topUp)}
        </>
      ) : (
        mode === 'PAYG' && (
          <>
            {dueToday(topUp, showAiNote ? ' (AI balance only)' : undefined)}
            <p>Devices are billed on {formatDate(firstBillingDate)}.</p>
          </>
        )
      )}
    </div>
  );
}
