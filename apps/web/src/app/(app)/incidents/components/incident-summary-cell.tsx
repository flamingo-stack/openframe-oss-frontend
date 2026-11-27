'use client';

import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import type { ReactNode } from 'react';
import { DETAIL_CELL_CLASS } from '@/app/components/shared/detail-cell';

/** A cell of the strip. `optional`: a cell only some incidents have. */
export function SummaryCell({ optional, children }: { optional?: boolean; children: ReactNode }) {
  return (
    <div data-loading-optional={optional || undefined} className={cn(DETAIL_CELL_CLASS, 'min-h-16 items-center')}>
      {children}
    </div>
  );
}
