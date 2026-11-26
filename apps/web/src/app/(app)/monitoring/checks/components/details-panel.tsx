'use client';

import { Card } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { ReactNode } from 'react';

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
