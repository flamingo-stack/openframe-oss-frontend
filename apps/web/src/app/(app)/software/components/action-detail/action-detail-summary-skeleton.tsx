'use client';

import { SummaryCardSkeleton } from '../shared/summary-card-skeleton';
import { ActionDetailLogsHeading } from './action-detail-logs-heading';
import { ACTION_DETAIL_SUMMARY_LABELS } from './action-detail-summary-labels';
import { UnifiedSkeleton } from '@flamingo-stack/openframe-frontend-core/components';

/** Same card and heading with the record's values as bars; the labels are real. */
export function ActionDetailSummarySkeleton() {
  return (
    <>
      <SummaryCardSkeleton columns={4} labels={Object.values(ACTION_DETAIL_SUMMARY_LABELS)} />
      <ActionDetailLogsHeading>
        <UnifiedSkeleton as="span" aria-hidden className="inline-block max-w-full align-middle h-8 w-48" />
      </ActionDetailLogsHeading>
    </>
  );
}
