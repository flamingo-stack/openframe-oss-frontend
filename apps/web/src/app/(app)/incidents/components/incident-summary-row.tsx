'use client';

import type { ReactNode } from 'react';

/** One strip of the card: cells wrap below the 4-up desktop layout instead of overflowing. */
export function SummaryRow({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-[var(--spacing-system-m)] border-b border-ods-border px-[var(--spacing-system-m)] py-[var(--spacing-system-s)] last:border-b-0">
      {children}
    </div>
  );
}
