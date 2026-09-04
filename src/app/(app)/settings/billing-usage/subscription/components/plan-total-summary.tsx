'use client';

import { Skeleton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { formatCurrency } from '../../lib/format';
import type { SelectionTotal } from '../types/subscription.types';

interface PlanTotalSummaryProps {
  /** Priced device selection; null while nothing priceable is selected. */
  total: SelectionTotal | null;
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
 * "due today" would be a bill the user never gets.
 */
export function PlanTotalSummary({ total, showAiNote, loading = false, className }: PlanTotalSummaryProps) {
  return (
    <div className={cn('flex flex-col text-ods-text-secondary text-h4', className)}>
      {showAiNote && <p>Devices and AI are billed together at checkout.</p>}
      {loading && <Skeleton className="mt-1 h-5 w-56" />}
      {total && (
        <p>
          {total.prepaid ? 'Total due today: ' : 'Estimated total: '}
          <span className="text-ods-text-primary text-h3">
            {formatCurrency(total.amount)}
            {!total.prepaid && ` / ${total.period}`}
          </span>
        </p>
      )}
    </div>
  );
}
