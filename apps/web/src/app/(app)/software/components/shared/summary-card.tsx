'use client';

import { UnifiedSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import type { ReactNode } from 'react';
import { InfoCell } from '@/app/components/shared/info-cell';

/** Static class names — Tailwind only sees whole literals. */
const GRID_COLUMNS = { 2: 'content-md:grid-cols-2', 3: 'content-md:grid-cols-3', 4: 'content-md:grid-cols-4' } as const;

export type SummaryCardColumns = keyof typeof GRID_COLUMNS;

export interface SummaryField {
  label: string;
  value: ReactNode;
}

interface SummaryCardProps {
  fields: readonly SummaryField[];
  /** How many fields sit side by side from md up; below md they stack. */
  columns: SummaryCardColumns;
  /** A full-width block above the fields (the CVE's description). */
  lead?: ReactNode;
}

/** A value that has not answered yet, at the value line's height. */
function SummaryValueSkeleton() {
  return <UnifiedSkeleton as="span" className="h-6 w-24" />;
}

/**
 * The card under a Software detail page's title: labelled values in a row,
 * stacked below md. In a loading scope the labels stay real and every value is
 * a bar, so loading and loaded share every metric by construction.
 */
export function SummaryCard({ fields, columns, lead }: SummaryCardProps) {
  const loading = useLoadingScope();
  return (
    <div className="flex flex-col rounded-md border border-ods-border bg-ods-card">
      {lead && <div className="flex flex-col border-b border-ods-border p-[var(--spacing-system-m)]">{lead}</div>}
      <div className={cn('grid grid-cols-1', GRID_COLUMNS[columns])}>
        {fields.map((field, idx) => (
          <div
            key={field.label}
            className={cn(
              'flex min-h-14 items-center p-[var(--spacing-system-m)] content-md:min-h-20',
              idx < fields.length - 1 && 'border-b border-ods-border content-md:border-b-0',
            )}
          >
            <InfoCell value={loading ? <SummaryValueSkeleton /> : field.value} label={field.label} />
          </div>
        ))}
      </div>
    </div>
  );
}
