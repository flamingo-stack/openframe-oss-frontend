'use client';

import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import type { ReactNode } from 'react';
import { InfoCell } from '@/app/components/shared/info-cell';

/** Static class names — Tailwind only sees whole literals. */
const GRID_COLUMNS = { 2: 'content-md:grid-cols-2', 3: 'content-md:grid-cols-3', 4: 'content-md:grid-cols-4' } as const;

export type SummaryCardColumns = keyof typeof GRID_COLUMNS;

export interface SummaryField {
  label: string;
  value: ReactNode;
  /** Drawn before the value, as `InfoCell` draws it (the OS's logo). */
  icon?: ReactNode;
  /** The icon's box while loading; see `InfoCell`. */
  iconSkeleton?: { className?: string };
}

interface SummaryCardProps {
  fields: readonly SummaryField[];
  /** How many fields sit side by side from md up; below md they go two to a row. */
  columns: SummaryCardColumns;
  /** A full-width block above the fields (the CVE's description). */
  lead?: ReactNode;
}

/**
 * The card under a Software detail page's title: labelled values in a row, two to a row below md (the phone frames
 * 1239:20463, 1059:18100, 1:10271), a rule between the rows. In a loading scope every `InfoCell` draws itself (label real,
 * value a text bar), so loading and loaded share every metric by construction.
 */
export function SummaryCard({ fields, columns, lead }: SummaryCardProps) {
  // Below md the fields pair up: every row but the last has a rule under it.
  const lastPhoneRow = fields.length - 1 - ((fields.length - 1) % 2);
  return (
    <div className="flex flex-col rounded-md border border-ods-border bg-ods-card">
      {lead && <div className="flex flex-col border-b border-ods-border p-[var(--spacing-system-m)]">{lead}</div>}
      <div className={cn('grid grid-cols-2', GRID_COLUMNS[columns])}>
        {fields.map((field, idx) => (
          <div
            key={field.label}
            className={cn(
              'flex min-h-14 items-center p-[var(--spacing-system-m)] content-md:min-h-20',
              idx < lastPhoneRow && 'border-b border-ods-border content-md:border-b-0',
            )}
          >
            <InfoCell
              value={field.value}
              label={field.label}
              icon={field.icon}
              iconSkeleton={field.iconSkeleton}
              skeletonWidth="w-24"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
