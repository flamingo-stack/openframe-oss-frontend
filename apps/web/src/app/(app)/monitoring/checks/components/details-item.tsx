'use client';

import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { ReactNode } from 'react';
import { ValueText } from '@/app/components/shared/value-text';

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
