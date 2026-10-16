'use client';

import { LoadingRegion, UnifiedSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { DotIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';

/** Only the first core line announces, or the box would say "loading" once per source. */
export function DataLossRowSkeleton({ width, announce = false }: { width: string; announce?: boolean }) {
  return (
    <LoadingRegion as="li" announce={announce} label="Loading your workspace data" className="flex h-6 items-center">
      <DotIcon aria-hidden className="size-6 shrink-0 text-ods-warning" />
      <UnifiedSkeleton className={`h-4 ${width}`} />
    </LoadingRegion>
  );
}

// One per core row.
const CORE_ROW_WIDTHS = ['w-1/2', 'w-1/3', 'w-3/4', 'w-2/3', 'w-2/5', 'w-3/4', 'w-1/2'] as const;

export function DataLossRowsSkeleton() {
  return CORE_ROW_WIDTHS.map((width, i) => <DataLossRowSkeleton key={i} width={width} announce={i === 0} />);
}
