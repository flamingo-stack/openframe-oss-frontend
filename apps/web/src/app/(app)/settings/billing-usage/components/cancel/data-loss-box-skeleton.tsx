'use client';

import { AlertCircleIcon, DotIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Skeleton } from '@flamingo-stack/openframe-frontend-core/components/ui';

// Mirrors the data-loss box structure (header chrome + 5 bulleted rows) so the
// loading state keeps the same shape instead of a flat rectangle.
const SKELETON_ROW_WIDTHS = ['w-1/2', 'w-3/4', 'w-2/5', 'w-1/3', 'w-3/4'] as const;

export function DataLossBoxSkeleton() {
  return (
    // Same `shrink-0`, same reason as `DataLossBox` — and it has to match, or the
    // loading state is the one that collapses.
    <div className="shrink-0 overflow-hidden rounded-md border border-ods-warning bg-ods-bg">
      <div className="flex items-center gap-[var(--spacing-system-xs)] border-b border-ods-warning bg-[var(--ods-open-yellow-secondary)] p-[var(--spacing-system-xsf)]">
        <AlertCircleIcon className="size-6 shrink-0 text-ods-warning" />
        <p className="flex-1 text-ods-warning text-h6">
          Once your subscription ends, this data will no longer be accessible.
        </p>
      </div>
      <ul className="flex flex-col gap-[var(--spacing-system-xxs)] p-[var(--spacing-system-s)]">
        {SKELETON_ROW_WIDTHS.map((width, i) => (
          <li key={i} className="flex h-6 items-center">
            <DotIcon aria-hidden className="size-6 shrink-0 text-ods-warning" />
            <Skeleton className={`h-4 ${width}`} />
          </li>
        ))}
      </ul>
    </div>
  );
}
