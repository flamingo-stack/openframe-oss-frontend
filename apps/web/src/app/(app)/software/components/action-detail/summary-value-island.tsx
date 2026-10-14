'use client';

import { ErrorBoundary } from '@flamingo-stack/openframe-frontend-core/components/features';
import { type ReactNode, Suspense } from 'react';
import { EmptyValue } from '@/app/components/shared';
import { UnifiedSkeleton } from '@flamingo-stack/openframe-frontend-core/components';

/** A summary value that loads on its own; a failure reads as empty instead of taking the page down. */
export function SummaryValueIsland({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary fallback={<EmptyValue />}>
      <Suspense fallback={<UnifiedSkeleton as="span" aria-hidden className="inline-block max-w-full align-middle h-6 w-20" />}>{children}</Suspense>
    </ErrorBoundary>
  );
}
