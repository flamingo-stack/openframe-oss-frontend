'use client';

import { type ReactNode, Suspense } from 'react';

/**
 * The Suspense boundary of a component that draws NOTHING: a hydrator that reads a query and reports it upward
 * (unread counts, the subscription status, billing banners, the current timer), or an observer that only reacts to
 * the URL. Its read must not suspend whatever sits above it, and while it waits there is nothing to stand in for,
 * so the fallback is empty. A component that draws anything gets a real fallback instead: itself in a loading
 * scope (`LoadingFallback`).
 */
export function HydratorBoundary({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null /* loading-standard-ok(SUSPENSE_FALLBACK): a hydrator draws nothing */}>
      {children}
    </Suspense>
  );
}
