'use client';

import { Card, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { ReactNode } from 'react';
import { ValueText } from '@/app/components/shared/value-text';

/**
 * The details panel: the design system's panel card, items with the label above the value. Stacked under each other
 * (a divider between them) in a narrow content area, one row from `content-md` up.
 */
export function DetailsPanel({ columns, children }: { columns: 'one' | 'three' | 'four'; children: ReactNode }) {
  const grid = {
    one: 'grid-cols-1',
    three: 'grid-cols-1 content-md:grid-cols-3',
    four: 'grid-cols-1 content-md:grid-cols-4',
  }[columns];
  return (
    <Card variant="panel" className={`grid divide-y divide-ods-border overflow-hidden content-md:divide-y-0 ${grid}`}>
      {children}
    </Card>
  );
}

interface DetailsItemProps {
  label: string;
  /** A text value is a bar while it is read; any other value (a tag) draws its own loading form. */
  value: ReactNode;
  skeletonWidth?: string;
}

/** One item of the panel: its label, then its value. */
export function DetailsItem({ label, value, skeletonWidth = 'w-24' }: DetailsItemProps) {
  const loading = useLoadingScope();
  return (
    <div className="flex min-h-16 min-w-0 flex-col justify-center p-[var(--spacing-system-xsf)]">
      <p className="truncate text-ods-text-secondary text-h6">{label}</p>
      {typeof value === 'string' ? (
        <ValueText value={loading ? null : value} loading={loading} skeletonWidth={skeletonWidth} />
      ) : (
        <div className="flex min-h-6 min-w-0 items-center text-ods-text-primary text-h4">{value}</div>
      )}
    </div>
  );
}
