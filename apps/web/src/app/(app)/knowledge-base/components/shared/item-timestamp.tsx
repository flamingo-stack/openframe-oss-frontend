'use client';

import { TruncateText } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { formatDate, formatTime } from '@/lib/format-date';
import type { Instant } from '@/lib/graphql-scalars';

/**
 * A date column of the knowledge base lists: the day over the time. `null` while the row is read (a loading scope):
 * both lines are bars.
 */
export function ItemTimestamp({ value }: { value: Instant | null }) {
  return (
    <div className="flex min-w-0 flex-col">
      <TruncateText>{value ? formatDate(value) : ''}</TruncateText>
      <TruncateText variant="h6" tone="secondary">
        {value ? formatTime(value) : ''}
      </TruncateText>
    </div>
  );
}
