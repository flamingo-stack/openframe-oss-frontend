'use client';

import type { ReactNode } from 'react';
import { InlineSkeleton } from '@/app/components/shared';
import { SummaryCard, type SummaryCardColumns } from './summary-card';

interface SummaryCardSkeletonProps {
  /** The live card's labels, in its order — they are static, so they render for real. */
  labels: readonly string[];
  columns: SummaryCardColumns;
  lead?: ReactNode;
}

/** A {@link SummaryCard} whose values are still loading: the labels are real, the values are bars. */
export function SummaryCardSkeleton({ labels, columns, lead }: SummaryCardSkeletonProps) {
  return (
    <SummaryCard
      fields={labels.map(label => ({ label, value: <InlineSkeleton className="h-6 w-24" /> }))}
      columns={columns}
      lead={lead}
    />
  );
}
