'use client';

import { Skeleton } from '@flamingo-stack/openframe-frontend-core/components/ui';

/**
 * Skeleton matching the inline `DeviceCard` rendered by `DeviceInfoSection`:
 * - p-4 card with `flex flex-col gap-4`
 * - Row 1: 32x32 icon box | (16px OS icon + name) over org | Details button
 * - Row 2: status tag + "Last Seen: ..." text
 */
export function DeviceInfoSectionSkeleton() {
  return (
    <div className="flex min-h-[130px] w-full flex-col justify-center gap-4 overflow-clip rounded-[6px] border border-ods-border bg-ods-card p-4">
      <div className="flex w-full items-center gap-4">
        <div className="flex shrink-0 items-center justify-center rounded-[6px] border border-ods-border p-2">
          <Skeleton className="h-4 w-4" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
          <div className="flex items-center gap-1">
            <Skeleton className="h-4 w-4 shrink-0" />
            <Skeleton className="h-5 w-40 max-w-full" />
          </div>
          <Skeleton className="h-4 w-16" />
        </div>
        <Skeleton className="h-12 w-[88px] shrink-0 rounded-[6px]" />
      </div>
      <div className="flex w-full items-center gap-2">
        <Skeleton className="h-6 w-16 shrink-0 rounded-[4px]" />
        <Skeleton className="h-5 w-48 max-w-full" />
      </div>
    </div>
  );
}
