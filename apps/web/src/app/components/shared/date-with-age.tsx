'use client';

import { DataTable, TruncateText, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { differenceInCalendarDays } from 'date-fns';
import { EMPTY_VALUE } from '@/lib/empty-value';
import { formatDate, toValidDate } from '@/lib/format-date';
import { pluralize } from '@/lib/pluralize';
import { ValueText } from './value-text';

/**
 * A date with its age in days on the line below — for dates whose age is the
 * point, like how long a CVE has been exposed in the fleet.
 */
export function DateWithAge({ date }: { date: string | number | Date | null | undefined }) {
  const value = toValidDate(date);
  if (!value) return <ValueText value={null} />;
  return (
    <div className="flex min-w-0 flex-col justify-center">
      <TruncateText>{formatDate(value)}</TruncateText>
      <TruncateText variant="h6" tone="secondary">
        {pluralize(differenceInCalendarDays(new Date(), value), 'day')}
      </TruncateText>
    </div>
  );
}

/**
 * `DateWithAge` in a grid table (`meta.gridCell`): one line, the date and its age after it. While the row is read (a
 * loading scope) it is the cell's own bar; with no date it is the cell with the empty mark.
 */
export function DateWithAgeGridCell({ date }: { date: string | number | Date | null | undefined }) {
  const loading = useLoadingScope();
  const value = toValidDate(date);
  if (loading) return <DataTable.Cell text="" />;
  if (!value) return <DataTable.Cell text={EMPTY_VALUE} />;
  return (
    <DataTable.Cell
      text={formatDate(value)}
      secondary={pluralize(differenceInCalendarDays(new Date(), value), 'day')}
    />
  );
}
