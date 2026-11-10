import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import type { ReactNode } from 'react';

// The cards of a directory record's page (Figma 1014:1222, 733:99325): one grid, two cells a row below `content-lg`
// (tablet 1019:3, phone 1019:35005) and four from it, so a cell keeps its column across rows. Rows are 80px from
// `content-md`.
export const DETAIL_CARD_CLASSES =
  'grid grid-cols-2 overflow-hidden rounded-md border border-ods-border bg-ods-card gap-x-[var(--spacing-system-s)] px-[var(--spacing-system-s)] content-md:gap-x-[var(--spacing-system-m)] content-md:px-[var(--spacing-system-m)] content-lg:grid-cols-4';
const CELL_CLASSES = 'flex min-w-0 items-center py-[var(--spacing-system-s)] content-md:min-h-20 content-md:py-0';

export function DetailCell({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn(CELL_CLASSES, className)}>{children}</div>;
}

/**
 * The line between two rows, across the card's padding. Where a row ends depends on the width: `narrow` breaks only
 * where two cells make a row, `wide` only where four do, `all` at both.
 */
export function RowDivider({ at }: { at: 'narrow' | 'wide' | 'all' }) {
  return (
    <div
      aria-hidden
      className={cn(
        'col-span-full -mx-[var(--spacing-system-s)] h-px bg-ods-border content-md:-mx-[var(--spacing-system-m)]',
        at === 'narrow' && 'content-lg:hidden',
        at === 'wide' && 'hidden content-lg:block',
      )}
    />
  );
}
