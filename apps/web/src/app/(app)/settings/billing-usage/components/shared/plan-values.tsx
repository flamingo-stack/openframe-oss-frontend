'use client';

import { formatCurrency } from '@/lib/format-currency';
import { formatCompactCount } from '@/lib/format-number';

/** A per-device price with its cadence trailing in secondary text. */
export function MonthlyRate({ amount }: { amount: number }) {
  return (
    <>
      {formatCurrency(amount)}
      <span className="text-ods-text-secondary">/ month</span>
    </>
  );
}

/** A monthly token grant: the count, with its cadence trailing. */
export function MonthlyTokens({ tokens }: { tokens: number }) {
  return (
    <>
      {formatCompactCount(tokens)}
      <span className="text-ods-text-secondary">/ month</span>
    </>
  );
}
