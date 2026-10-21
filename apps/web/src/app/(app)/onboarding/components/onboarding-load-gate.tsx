'use client';

import { LoadingFallback } from '@flamingo-stack/openframe-frontend-core/components';
import { LoadingWhen } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { type ReactNode, Suspense } from 'react';

interface OnboardingLoadGateProps {
  /** Progress is not read yet (or the surface is about to leave): the view is drawn in a loading scope. */
  pending: boolean;
  /** The loading region's label while the loaded content suspends on its own reads. */
  label: string;
  /** The surface's view with no progress, drawn in a loading scope (every row draws its own state). */
  view: ReactNode;
  /** The loaded content, mounted once progress is read. */
  children: ReactNode;
}

/**
 * The one loading gate of the onboarding surfaces (the dashboard's Initial Setup card and the Get Started page): the
 * view in a loading scope while progress is read, then the loaded content behind a Suspense whose fallback is the
 * same view, so the whole load reads as one loading state.
 */
export function OnboardingLoadGate({ pending, label, view, children }: OnboardingLoadGateProps) {
  return (
    <LoadingWhen loading={pending}>
      {pending ? (
        view
      ) : (
        <Suspense fallback={<LoadingFallback label={label}>{view}</LoadingFallback>}>{children}</Suspense>
      )}
    </LoadingWhen>
  );
}
