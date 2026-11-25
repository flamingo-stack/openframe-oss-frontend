'use client';

import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import type { ReactNode } from 'react';
import { DETAIL_CELL_CLASS } from '@/app/components/shared/detail-cell';

/** One strip of the card: cells wrap below the 4-up desktop layout instead of overflowing. */
export function SummaryRow({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-[var(--spacing-system-m)] border-b border-ods-border px-[var(--spacing-system-m)] py-[var(--spacing-system-s)] last:border-b-0">
      {children}
    </div>
  );
}

/** A cell of the strip. `optional`: a cell only some incidents have. */
export function SummaryCell({ optional, children }: { optional?: boolean; children: ReactNode }) {
  return (
    <div data-loading-optional={optional || undefined} className={cn(DETAIL_CELL_CLASS, 'min-h-16 items-center')}>
      {children}
    </div>
  );
}
