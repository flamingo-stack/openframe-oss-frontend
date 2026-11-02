'use client';

import { type ReactNode, Suspense, useEffect } from 'react';
import { ContentErrorBoundary } from '@/app/components/shared/content-error-boundary';
import type { NeedsYouSource, ReportSource } from './needs-you-rows';

interface NeedsYouSourceBoundaryProps {
  /** What the source below reports; a failure is reported for each of them. */
  sources: readonly NeedsYouSource[];
  onReport: ReportSource;
  children: ReactNode;
}

/**
 * Runs one Relay-backed "Needs you" source on its own, so the sources fetch side by side
 * and one failing backend costs only its own rows. The source suspends without a fallback
 * of its own — the card draws the loading state — and a failure is reported to the card
 * with the boundary's retry instead of being drawn here.
 */
export function NeedsYouSourceBoundary({ sources, onReport, children }: NeedsYouSourceBoundaryProps) {
  return (
    <ContentErrorBoundary
      label="NeedsYou"
      // Back to loading before the remount, so the card does not keep the failure line
      // over a request that is already running again.
      onRetry={() => {
        for (const source of sources) onReport(source, { status: 'loading' });
      }}
      fallback={(retry, { isOffline }) => (
        <ReportFailure sources={sources} onReport={onReport} isOffline={isOffline} retry={retry} />
      )}
    >
      {/* loading-standard-ok(SUSPENSE_FALLBACK): the sources draw nothing; the card draws their loading state */}
      <Suspense fallback={null}>{children}</Suspense>
    </ContentErrorBoundary>
  );
}

interface ReportFailureProps {
  sources: readonly NeedsYouSource[];
  onReport: ReportSource;
  isOffline: boolean;
  retry: () => void;
}

function ReportFailure({ sources, onReport, isOffline, retry }: ReportFailureProps) {
  useEffect(() => {
    for (const source of sources) onReport(source, { status: 'error', isOffline, retry });
  }, [sources, onReport, isOffline, retry]);
  return null;
}
