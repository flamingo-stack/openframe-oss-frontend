'use client';

import { type PageActionButton, Skeleton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { InlineSkeleton } from '@/app/components/shared';
import { TENANT_DETAIL_TITLE, TenantDetailTitle } from './tenant-detail-title';
import { TenantSummaryCardSkeleton } from './tenant-summary-card';

interface TenantDetailSkeletonProps {
  actions?: PageActionButton[];
  loadingActions?: boolean;
}

/** `TenantDetailContent` while the record loads: the title as a bar, the card and the section as blocks. */
export function TenantDetailSkeleton({ actions, loadingActions }: TenantDetailSkeletonProps) {
  return (
    <>
      <TenantDetailTitle title={TENANT_DETAIL_TITLE} loading actions={actions} loadingActions={loadingActions} />
      <div className="flex flex-1 flex-col gap-[var(--spacing-system-l)]">
        <TenantSummaryCardSkeleton />
        <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
          <InlineSkeleton className="h-4 w-24" />
          <Skeleton className="h-[284px] w-full rounded-md" />
        </div>
      </div>
    </>
  );
}
