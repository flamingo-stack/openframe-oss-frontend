'use client';

import { routes } from '@/lib/routes';
import { DetailTitle } from '../shared/detail-title';
import { SummaryCardSkeleton } from '../shared/summary-card-skeleton';
import { SOFTWARE_DETAIL_SUMMARY_LABELS } from './software-detail-summary-labels';
import { SOFTWARE_DETAIL_TITLE } from './software-detail-title';

/** `SoftwareDetailContent` while the record loads — the title and values as bars; the tab strip waits. */
export function SoftwareDetailSkeleton() {
  return (
    <>
      <DetailTitle title={SOFTWARE_DETAIL_TITLE} backTo={routes.software.list} loading />
      <div className="flex flex-1 flex-col gap-[var(--spacing-system-l)]">
        <SummaryCardSkeleton columns={2} labels={Object.values(SOFTWARE_DETAIL_SUMMARY_LABELS)} />
      </div>
    </>
  );
}
