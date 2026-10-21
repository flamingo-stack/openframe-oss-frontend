'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { ErrorBoundary } from '@flamingo-stack/openframe-frontend-core/components/features';
import type { ReactNode } from 'react';
import { EmptyValue } from '@/app/components/shared';

/**
 * A summary value that loads on its own; a failure reads as empty instead of taking the page down. While it loads
 * the value itself is drawn in a loading scope, where it draws its own loading state and reads nothing.
 */
export function SummaryValueIsland({ label, children }: { label: string; children: ReactNode }) {
  return (
    <ErrorBoundary fallback={<EmptyValue />}>
      <LoadingSuspense label={label}>{children}</LoadingSuspense>
    </ErrorBoundary>
  );
}
