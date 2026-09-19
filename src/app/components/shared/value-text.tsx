'use client';

import { TruncateText } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { isEmptyValue } from '@/lib/empty-value';
import { EmptyValue } from './empty-value';

/** A table cell's text in the cell's type (h4), or the muted empty mark when there is none. */
export function ValueText({ value }: { value: string | number | null | undefined }) {
  if (isEmptyValue(value)) {
    return (
      <span className="text-h4">
        <EmptyValue />
      </span>
    );
  }
  return <TruncateText>{String(value)}</TruncateText>;
}
