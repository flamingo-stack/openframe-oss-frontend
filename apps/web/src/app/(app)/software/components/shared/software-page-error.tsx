'use client';

import { LoadError, PageLayout } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { ReactNode } from 'react';
import { loadErrorProps } from '@/lib/query-state';

/**
 * Failed-load state for a Software page — the page title redrawn above the
 * error card, since the `PageLayout` that normally carries it lives inside the
 * subtree that threw.
 *
 * Same thing `ContentErrorBoundary`'s own `title` branch does, with one
 * difference that is the whole reason this exists: core's `ErrorState` wraps
 * itself in a hardcoded `p-6` the card cannot opt out of, so the default
 * fallback's card sits 24px further in than the title above it. `-m-6` cancels
 * that padding, putting the card's left edge on the title's and leaving the same
 * gap under the header the table has.
 */
export function softwarePageErrorFallback(title: string, message: string) {
  // Named rather than an arrow: it returns JSX, so `react/display-name` reads an
  // anonymous one as a component definition with no name.
  return function SoftwarePageError(retry: () => void, state: { isOffline: boolean }): ReactNode {
    return (
      <PageLayout title={title}>
        <div className="-m-6">
          <LoadError {...loadErrorProps(state.isOffline, message, retry)} />
        </div>
      </PageLayout>
    );
  };
}
