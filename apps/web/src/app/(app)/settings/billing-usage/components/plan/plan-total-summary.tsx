'use client';

import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { formatCurrency } from '@/lib/format-currency';
import type { DevicePlanMode, SelectionTotal } from './plan-selection';

interface PlanTotalSummaryProps {
  /** How the devices are paid for; `null` until the picker reports. */
  mode: DevicePlanMode | null;
  /** The prepaid year's figure; null on pay-as-you-go or while nothing priceable is selected. */
  total: SelectionTotal | null;
  /**
   * The AI top-up riding on this checkout, in whole dollars — charged on the
   * checkout's own invoice, so it joins the year's total.
   * `null` when the plan has no AI product or no top-up is chosen.
   */
  topUpUsd: number | null;
  /** Whether the AI add-on is part of this plan, and therefore worth explaining. */
  showAiNote: boolean;
  loading?: boolean;
  className?: string;
}

/**
 * What a prepaid year costs today, next to the submit button: the year plus the
 * top-up. Pay-as-you-go draws nothing here — its devices are not charged today,
 * and the device card names the day they are. So does the wait: the picker shows
 * pay-as-you-go until the catalog lands.
 */
export function PlanTotalSummary({
  mode,
  total,
  topUpUsd,
  showAiNote,
  loading = false,
  className,
}: PlanTotalSummaryProps) {
  const isLoading = useLoadingScope() || loading;
  const topUp = topUpUsd != null && topUpUsd > 0 ? topUpUsd : 0;

  return (
    <div className={cn('flex flex-col text-ods-text-secondary text-h4', className)}>
      {!isLoading && mode === 'ANNUAL' && (
        <>
          {showAiNote && <p>Devices and AI balance are billed together at checkout.</p>}
          {total && (
            <p>
              Total due today:{' '}
              <span className="text-ods-text-primary text-h3">{formatCurrency(total.amount + topUp)}</span>
            </p>
          )}
        </>
      )}
    </div>
  );
}
