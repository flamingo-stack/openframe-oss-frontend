'use client';

import { LoadingRegion, UnifiedSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { SummaryCardSkeleton } from '../shared/summary-card-skeleton';
import { ActionDetailLogsHeading } from './action-detail-logs-heading';
import { ACTION_DETAIL_SUMMARY_LABELS } from './action-detail-summary-labels';

/** Same card and heading with the record's values as bars; the labels are real. */
export function ActionDetailSummarySkeleton() {
  return (
    <LoadingRegion className="contents" label="Loading action">
      <SummaryCardSkeleton columns={4} labels={Object.values(ACTION_DETAIL_SUMMARY_LABELS)} />
      <ActionDetailLogsHeading>
        <UnifiedSkeleton as="span" className="h-8 w-48" />
      </ActionDetailLogsHeading>
    </LoadingRegion>
  );
}
