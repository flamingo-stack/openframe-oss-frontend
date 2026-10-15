'use client';

import { LoadingRegion, UnifiedSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { ErrorBoundary } from '@flamingo-stack/openframe-frontend-core/components/features';
import { type ReactNode, Suspense } from 'react';
import { EmptyValue } from '@/app/components/shared';

/** A summary value that loads on its own; a failure reads as empty instead of taking the page down. */
export function SummaryValueIsland({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary fallback={<EmptyValue />}>
      {/* Busy without a status of its own: several values of one card load at once, and one "loading" each would
          repeat itself. */}
      <Suspense
        fallback={
          <LoadingRegion as="span" status={false} className="contents">
            <UnifiedSkeleton as="span" className="h-6 w-20" />
          </LoadingRegion>
        }
      >
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}
