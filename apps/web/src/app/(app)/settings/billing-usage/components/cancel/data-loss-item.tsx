'use client';

import { DotIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { ReactNode } from 'react';
import { LoadingLine } from '@/app/components/shared/loading-line';
import { formatCount } from '@/lib/format-number';

/** "1,200+": a count rounded down to the hundred once it reaches a thousand — what the user is about to lose, not an audit. */
function formatApproximateCount(value: number): string {
  return value >= 1000 ? `${formatCount(Math.floor(value / 100) * 100)}+` : formatCount(value);
}

/**
 * One line of what the workspace loses: the dot is real; in a loading scope the sentence (a count and its noun,
 * `children`, then unread) is a bar.
 */
export function DataLossItem({ children, skeletonWidth = 'w-2/5' }: { children?: ReactNode; skeletonWidth?: string }) {
  const loading = useLoadingScope();
  return (
    <div role="listitem" data-loading-item className="flex items-start text-ods-text-primary text-h3">
      <DotIcon aria-hidden className="size-6 shrink-0 text-ods-warning" />
      <span className="flex-1">
        {loading ? <LoadingLine as="span" type="h3" className={skeletonWidth} /> : children}
      </span>
    </div>
  );
}

export function DataLossStat({ value }: { value: number | string }) {
  return (
    <span className="text-ods-warning text-h4">
      {typeof value === 'number' ? formatApproximateCount(value) : value}
    </span>
  );
}
