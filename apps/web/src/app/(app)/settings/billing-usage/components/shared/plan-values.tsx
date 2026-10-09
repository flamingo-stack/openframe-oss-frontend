'use client';

import { AlertTriangleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { formatCurrency } from '@/lib/format-currency';
import { formatDate } from '@/lib/format-date';
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

/** A date the user should notice: something starts or stops on it. */
export function WarningDate({ iso }: { iso: string }) {
  return (
    <>
      {formatDate(iso)}
      <AlertTriangleIcon className="size-4 text-ods-warning" />
    </>
  );
}
