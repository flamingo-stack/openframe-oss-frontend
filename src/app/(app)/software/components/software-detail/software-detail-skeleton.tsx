'use client';

import { routes } from '@/lib/routes';
import { DetailTitle } from '../shared/detail-title';
import { SummaryCardSkeleton } from '../shared/summary-card-skeleton';
import { SOFTWARE_DETAIL_SUMMARY_LABELS } from './software-detail-summary-labels';
import { SOFTWARE_DETAIL_TITLE } from './software-detail-title';

/**
 * `SoftwareDetailContent` while the record loads — the title and the card's
 * values as bars. That is all that waits: the tab strip, the search bar and
 * the list's own skeleton are the real tabs, mounted beside this by the view.
 */
export function SoftwareDetailSkeleton() {
  return (
    <>
      <DetailTitle title={SOFTWARE_DETAIL_TITLE} backTo={routes.software.list} loading />
      <SummaryCardSkeleton columns={2} labels={Object.values(SOFTWARE_DETAIL_SUMMARY_LABELS)} />
    </>
  );
}
