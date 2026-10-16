'use client';

import { LoadingRegion, UnifiedSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { CARD_CONTAINER, CARD_ROW } from './employee-details-card';
import { EmployeeDetailsFieldSkeleton } from './employee-details-field-skeleton';

/** `EmployeeDetailsSummary` while the record loads: the same card, its values as bars. */
export function EmployeeDetailsSummarySkeleton() {
  return (
    <LoadingRegion label="Loading employee" className={CARD_CONTAINER}>
      <div className={CARD_ROW}>
        <div className="flex min-w-0 flex-1 items-center gap-[var(--spacing-system-m)]">
          {/* Mirrors the loaded avatar: 36px on mobile, 48px on md+. */}
          <UnifiedSkeleton className="size-9 shrink-0 rounded-full content-md:size-12" />
          <EmployeeDetailsFieldSkeleton valueClassName="h-6 w-32" />
        </div>
        <EmployeeDetailsFieldSkeleton valueClassName="h-6 w-40" />
      </div>
      <div className={`${CARD_ROW} border-t border-ods-border`}>
        <EmployeeDetailsFieldSkeleton valueClassName="h-6 w-24" />
        <EmployeeDetailsFieldSkeleton valueClassName="h-8 w-16 rounded-md" />
      </div>
    </LoadingRegion>
  );
}
