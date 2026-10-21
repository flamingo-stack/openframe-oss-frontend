'use client';

import { AlertCircleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import type { ReactNode } from 'react';
import { DataLossModuleRows } from './data-loss-module-rows';

/**
 * The header paints at once; `children` (the core rows) and the module rows load
 * on their own. With no line left, loading ones included, the box hides (`:has([role=listitem])`).
 *
 * A `div` list rather than a `ul`: a part still loading is its Suspense boundary's `LoadingFallback`, whose region
 * is a `div`, which a `ul` may not hold. The list flattens those regions (`display: contents`) so its gap spaces
 * the lines, loading or loaded, alike.
 */
export function DataLossBox({ children }: { children: ReactNode }) {
  return (
    // `shrink-0` is load-bearing, not defensive. The modal body is a flex column
    // that scrolls, and a flex item's automatic minimum size — the thing that
    // normally stops one shrinking below its content — applies only while its
    // overflow is `visible`. `overflow-hidden` (here, to clip the header band
    // against the rounded border) opts this box out of that protection, so it was
    // the ONE child the column could crush: it collapsed to a sliver instead of
    // pushing the body into a scroll.
    <div className="shrink-0 overflow-hidden rounded-md border border-ods-warning bg-ods-bg [&:not(:has([role=listitem]))]:hidden">
      <div className="flex items-center gap-[var(--spacing-system-xs)] border-b border-ods-warning bg-[var(--ods-open-yellow-secondary)] p-[var(--spacing-system-xsf)]">
        <AlertCircleIcon className="size-6 shrink-0 text-ods-warning" />
        <p className="flex-1 text-ods-warning text-h6">
          Once your subscription ends, this data will no longer be accessible.
        </p>
      </div>
      <div
        role="list"
        className="flex flex-col gap-[var(--spacing-system-xxs)] p-[var(--spacing-system-s)] [&>div:not([role])]:contents"
      >
        {children}
        <DataLossModuleRows />
      </div>
    </div>
  );
}
