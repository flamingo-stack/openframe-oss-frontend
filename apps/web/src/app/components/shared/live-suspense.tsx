'use client';

import { LoadingStatus, LoadingWhen, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { type ReactNode, Suspense } from 'react';

/**
 * A Suspense boundary whose waiting view stays operable. `LoadingSuspense` draws its fallback inert, which is right for
 * a body (nothing there may act on a record that has not answered) but also kills the controls a waiting page must
 * keep: Back, a lock screen's exits, a search box. Here the view draws in a BARE loading scope instead: every part still
 * draws its own loading form and `PageActions` still draws the actions inert, but nothing else is locked. The polite
 * status is the same one `LoadingSuspense` reads.
 *
 * Only for a view that locks what it must itself: a title block, a search bar, a frame whose fields take `disabled`. A
 * view with a live form below its title keeps `LoadingSuspense`, or wraps that body in a `LoadingScope` of its own.
 */
export function LiveSuspense({
  label,
  view,
  gated = false,
  children,
}: {
  /** What is loading, for assistive technology. */
  label: string;
  /** The view the boundary waits on, with no data (it draws itself in the scope). */
  view: ReactNode;
  /** A page gate (a feature flag, a role) has not answered: draw `view` and send nothing (`GatedSuspense`'s gate). */
  gated?: boolean;
  /** The query component (it suspends). */
  children: ReactNode;
}) {
  const outer = useLoadingScope();
  const waiting = (
    <>
      <LoadingWhen loading>{view}</LoadingWhen>
      {!outer && <LoadingStatus label={label} />}
    </>
  );
  if (gated) return waiting;
  return <Suspense fallback={waiting}>{children}</Suspense>;
}
