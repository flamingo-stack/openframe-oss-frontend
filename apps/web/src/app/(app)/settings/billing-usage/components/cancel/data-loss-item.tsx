'use client';

import { DotIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import type { ReactNode } from 'react';
import { formatCount } from '@/lib/format-number';

/** "1,200+": a count rounded down to the hundred once it reaches a thousand — what the user is about to lose, not an audit. */
function formatApproximateCount(value: number): string {
  return value >= 1000 ? `${formatCount(Math.floor(value / 100) * 100)}+` : formatCount(value);
}

export function DataLossItem({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start text-ods-text-primary text-h3">
      <DotIcon aria-hidden className="size-6 shrink-0 text-ods-warning" />
      <span className="flex-1">{children}</span>
    </li>
  );
}

export function DataLossStat({ value }: { value: number | string }) {
  return (
    <span className="text-ods-warning text-h4">
      {typeof value === 'number' ? formatApproximateCount(value) : value}
    </span>
  );
}
