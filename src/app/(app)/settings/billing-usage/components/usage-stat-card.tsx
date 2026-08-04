'use client';

import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import type { ReactNode } from 'react';

interface UsageStatCardProps {
  title: string;
  /** Headline figure. A node, so a unit or a total can trail it in secondary text. */
  value: ReactNode;
  /** The line under the figure — what it is measured against, or how it is billed. */
  caption: ReactNode;
  className?: string;
}

/**
 * Headline counter with a caption beneath it — the billing page's top row.
 *
 * Not core's `DashboardInfoCard`: that card puts its secondary text BESIDE the
 * value (`subValue`) and reserves the right slot for a progress ring, at a fixed
 * height sized for exactly that. This row needs the caption on its own line and
 * no ring, which it has no variant for. So the composition lives here, in the
 * page that needs it, on the same ODS tokens the card is built from.
 */
export function UsageStatCard({ title, value, caption, className }: UsageStatCardProps) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-1 flex-col justify-center gap-[var(--spacing-system-xsf)]',
        'rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-mf)]',
        className,
      )}
    >
      <div className="flex flex-col">
        <p className="truncate text-h5 text-ods-text-secondary">{title}</p>
        <p className="truncate text-h2 text-ods-text-primary">{value}</p>
      </div>
      <p className="truncate text-h6 text-ods-text-secondary">{caption}</p>
    </div>
  );
}

/** Trailing part of a figure that qualifies it rather than states it ("/10M", "balance"). */
export function StatSuffix({ children }: { children: ReactNode }) {
  return <span className="text-ods-text-secondary">{children}</span>;
}
