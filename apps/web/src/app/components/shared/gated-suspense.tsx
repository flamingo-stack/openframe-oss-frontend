'use client';

import { LoadingFallback, LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import type { ReactNode } from 'react';

/**
 * A Suspense boundary behind a page gate (a feature flag, a role, a test mode) that decides whether its query is sent
 * at all. The SAME view with no data, in a loading scope, stands in for both waits: the gate's own window (`gated`,
 * when the query is not sent yet) and the query in flight (the boundary's fallback). One rule, so no page spells the
 * two branches again.
 */
export function GatedSuspense({
  gated,
  label,
  view,
  children,
}: {
  /** The page's gate has not answered yet: draw `view` in a loading scope and send nothing. */
  gated: boolean;
  /** What is loading, for assistive technology. */
  label: string;
  /** The view the boundary waits on, with no data (it draws itself in the scope). */
  view: ReactNode;
  /** The query component (it suspends). */
  children: ReactNode;
}) {
  if (gated) return <LoadingFallback label={label}>{view}</LoadingFallback>;
  return (
    <LoadingSuspense label={label} fallback={view}>
      {children}
    </LoadingSuspense>
  );
}
