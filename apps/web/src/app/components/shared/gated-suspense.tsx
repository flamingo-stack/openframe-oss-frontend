'use client';

import { LoadingFallback, LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { LoadingWhen } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { ReactNode } from 'react';

/**
 * A Suspense boundary behind a page gate (a feature flag, a role, a test mode, a progress read) that decides whether
 * its query is sent at all. The SAME view with no data, in a loading scope, stands in for both waits: the gate's own
 * window (`gated`, when the query is not sent yet) and the query in flight (the boundary's fallback). One rule, so no
 * page spells the two branches again.
 */
export function GatedSuspense({
  gated,
  label,
  view,
  bare = false,
  children,
}: {
  /** The page's gate has not answered yet: draw `view` in a loading scope and send nothing. */
  gated: boolean;
  /** What is loading, for assistive technology. */
  label: string;
  /** The view the boundary waits on, with no data (it draws itself in the scope). */
  view: ReactNode;
  /**
   * The gate's window draws the scope only (`LoadingWhen`, no region element of its own) instead of an announced
   * `LoadingFallback`: for a view that sits inside a surface which already announces its load, or whose layout an
   * extra element would break. The scope stays mounted across the gate, so the view is not remounted.
   */
  bare?: boolean;
  /** The query component (it suspends). */
  children: ReactNode;
}) {
  const boundary = (
    <LoadingSuspense label={label} fallback={view}>
      {children}
    </LoadingSuspense>
  );
  if (bare) return <LoadingWhen loading={gated}>{gated ? view : boundary}</LoadingWhen>;
  if (gated) return <LoadingFallback label={label}>{view}</LoadingFallback>;
  return boundary;
}
