'use client';

import { TextLineSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { DotIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { ReactNode } from 'react';
import { formatCount } from '@/lib/format-number';

/** "1,200+": a count rounded down to the hundred once it reaches a thousand — what the user is about to lose, not an audit. */
function formatApproximateCount(value: number): string {
  return value >= 1000 ? `${formatCount(Math.floor(value / 100) * 100)}+` : formatCount(value);
}

const ITEM_CLASS = 'flex items-start text-ods-text-primary text-h3';

/** A line of the box while its count is on its way: the dot is real, the sentence (a count and its noun) a bar. */
function DataLossItemSkeleton({ width = 'w-2/5' }: { width?: string }) {
  return (
    <div role="listitem" data-loading-item className={ITEM_CLASS}>
      <DotIcon aria-hidden className="size-6 shrink-0 text-ods-warning" />
      <span className="flex-1">
        <TextLineSkeleton as="span" type="h3" className={width} />
      </span>
    </div>
  );
}

/** One line of what the workspace loses; in a loading scope, its skeleton (`children` is then unread). */
export function DataLossItem({ children, skeletonWidth }: { children?: ReactNode; skeletonWidth?: string }) {
  if (useLoadingScope()) return <DataLossItemSkeleton width={skeletonWidth} />;
  return (
    <div role="listitem" data-loading-item className={ITEM_CLASS}>
      <DotIcon aria-hidden className="size-6 shrink-0 text-ods-warning" />
      <span className="flex-1">{children}</span>
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
