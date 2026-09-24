'use client';

import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import type { ReactNode } from 'react';
import { InfoCell } from '@/app/components/shared/info-cell';

/** Static class names — Tailwind only sees whole literals. */
const GRID_COLUMNS = { 2: 'md:grid-cols-2', 4: 'md:grid-cols-4' } as const;

export interface SummaryField {
  label: string;
  value: ReactNode;
}

interface SummaryCardProps {
  fields: readonly SummaryField[];
  /** How many fields sit side by side from md up; below md they stack. */
  columns: keyof typeof GRID_COLUMNS;
  /** A full-width block above the fields (the CVE's description). */
  lead?: ReactNode;
}

/**
 * The card under a Software detail page's title: labelled values in a row,
 * stacked below md. Loaded and loading both draw through it, so the two share
 * every metric by construction.
 */
export function SummaryCard({ fields, columns, lead }: SummaryCardProps) {
  return (
    <div className="flex flex-col rounded-md border border-ods-border bg-ods-card">
      {lead && <div className="flex flex-col border-b border-ods-border p-[var(--spacing-system-m)]">{lead}</div>}
      <div className={cn('grid grid-cols-1', GRID_COLUMNS[columns])}>
        {fields.map((field, idx) => (
          <div
            key={field.label}
            className={cn(
              'flex min-h-14 items-center p-[var(--spacing-system-m)] md:min-h-20',
              idx < fields.length - 1 && 'border-b border-ods-border md:border-b-0',
            )}
          >
            <InfoCell value={field.value} label={field.label} />
          </div>
        ))}
      </div>
    </div>
  );
}
