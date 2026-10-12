'use client';

import { Skeleton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { CARD_CONTAINER, CARD_ROW } from './employee-details-card';

/** A value bar above its label bar — one field of the card. */
function profileField(valueClassName: string) {
  return (
    <div className="flex min-w-0 flex-1 flex-col justify-center gap-[var(--spacing-system-xxs)]">
      <Skeleton className={valueClassName} />
      <Skeleton className="h-4 w-16" />
    </div>
  );
}

/** `EmployeeDetailsSummary` while the record loads: the same card, its values as bars. */
export function EmployeeDetailsSummarySkeleton() {
  return (
    <div className={CARD_CONTAINER}>
      <div className={CARD_ROW}>
        <div className="flex min-w-0 flex-1 items-center gap-[var(--spacing-system-m)]">
          {/* Mirrors the loaded avatar: 36px on mobile, 48px on md+. */}
          <Skeleton className="size-9 shrink-0 rounded-full content-md:size-12" />
          {profileField('h-6 w-32')}
        </div>
        {profileField('h-6 w-40')}
      </div>
      <div className={`${CARD_ROW} border-t border-ods-border`}>
        {profileField('h-6 w-24')}
        {profileField('h-8 w-16 rounded-md')}
      </div>
    </div>
  );
}
