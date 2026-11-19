'use client';

import { DataTable, TruncateText } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { formatDate, formatTime } from '@/lib/format-date';
import type { Instant } from '@/lib/graphql-scalars';

/**
 * A date column of the knowledge base lists: the day over the time. `null` while the row is read (a loading scope):
 * both lines are bars. `grid`: the cell's form in a grid table, one line (the day, the time beside it).
 */
export function ItemTimestamp({ value, grid }: { value: Instant | null; grid?: boolean }) {
  if (grid) {
    return <DataTable.Cell text={value ? formatDate(value) : ''} secondary={value ? formatTime(value) : undefined} />;
  }
  return (
    <div className="flex min-w-0 flex-col">
      <TruncateText>{value ? formatDate(value) : ''}</TruncateText>
      <TruncateText variant="h6" tone="secondary">
        {value ? formatTime(value) : ''}
      </TruncateText>
    </div>
  );
}
