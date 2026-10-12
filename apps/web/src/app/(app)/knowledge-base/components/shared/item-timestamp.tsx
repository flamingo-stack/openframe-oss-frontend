'use client';

import { TruncateText } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { formatDate, formatTime } from '@/lib/format-date';
import type { Instant } from '@/lib/graphql-scalars';

/** A date column of the knowledge base lists: the day over the time. */
export function ItemTimestamp({ value }: { value: Instant }) {
  return (
    <div className="flex min-w-0 flex-col">
      <TruncateText>{formatDate(value)}</TruncateText>
      <TruncateText variant="h6" tone="secondary">
        {formatTime(value)}
      </TruncateText>
    </div>
  );
}
