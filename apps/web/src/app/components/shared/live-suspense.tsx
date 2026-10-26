'use client';

import { LoadingStatus, LoadingWhen, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { type ReactNode, Suspense } from 'react';

/**
 * A Suspense boundary whose waiting view is not inert. `LoadingSuspense` draws its fallback inert, which is right for a
 * body (nothing there may act on a record that has not answered) but also kills Back, which reads no data and must
 * work while the page waits. Here the view draws in a BARE loading scope instead, with the same status announcement:
 * every part still draws its own loading form, and every control that reads the scope still locks itself (`PageActions`,
 * actions menus, inputs, selects). Only the controls that do not read it stay live: Back, a plain `Button`, a search
 * field like `TagSearchInput`.
 *
 * The scope cannot be turned off below this point (a modal opened from the view inherits it), so a control that must
 * work through the wait AND reads the scope does not belong in this view. A view with a live form below its title keeps
 * `LoadingSuspense`, or wraps that body in a `LoadingScope` of its own.
 */
export function LiveSuspense({
  label,
  view,
  gated = false,
  children,
}: {
  /** What is loading, for assistive technology. */
  label: string;
  /**
   * The view the boundary waits on, with no data. Defaults to `children`, which must then draw themselves in the scope
   * WITHOUT fetching (switch on `useLoadingScope()` before their query), or the fallback suspends too.
   */
  view?: ReactNode;
  /** A page gate (a feature flag, a role) has not answered: draw the view and send nothing (`GatedSuspense`'s gate). */
  gated?: boolean;
  /** The query component (it suspends). */
  children: ReactNode;
}) {
  const outer = useLoadingScope();
  const waiting = (
    <>
      <LoadingWhen loading>{view ?? children}</LoadingWhen>
      {!outer && <LoadingStatus label={label} />}
    </>
  );
  if (gated) return waiting;
  return <Suspense fallback={waiting}>{children}</Suspense>;
}
