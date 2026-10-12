'use client';

import { type ReactNode, Suspense } from 'react';
import { graphql } from 'react-relay';
import type { autoTopUpIslandQuery as AutoTopUpIslandQueryType } from '@/__generated__/autoTopUpIslandQuery.graphql';
import { ContentErrorBoundary, QueryIsland } from '@/app/components/shared';
import { type AutoTopUpStatus, toAutoTopUpStatus } from './auto-top-up-status';

/**
 * The standing auto top-up arrangement, on its own request.
 *
 * `autoTopUpSettings` is non-null, so a refusal would null the WHOLE payload it
 * rides on — and the billing page must not go down with a feature that only
 * decorates one card. Every island asks with the same variables, so Relay
 * makes one fetch of it however many parts of the page read it.
 */
const autoTopUpIslandQuery = graphql`
  query autoTopUpIslandQuery {
    autoTopUpSettings {
      ...autoTopUpStatus_settings
    }
  }
`;

interface AutoTopUpIslandProps {
  /** Console prefix identifying the part, for the boundary. */
  label: string;
  /**
   * The part without the arrangement: what it shows while the arrangement is
   * on its way, and what it degrades to if the arrangement cannot be loaded.
   */
  fallback: ReactNode;
  children: (status: AutoTopUpStatus) => ReactNode;
}

/**
 * One part of the page that reads the arrangement, with its own wait and its
 * own failure so that neither reaches the page around it. A failure shows the
 * same thing as the wait — never an error card where a figure is.
 */
export function AutoTopUpIsland({ label, fallback, children }: AutoTopUpIslandProps) {
  return (
    // The boundary's fallback has to be an element to count as one: a bare
    // `null` would hand the default error card to a part whose failure is
    // nothing to show.
    <ContentErrorBoundary label={label} fallback={() => <>{fallback}</>}>
      <Suspense fallback={fallback}>
        <QueryIsland<AutoTopUpIslandQueryType> query={autoTopUpIslandQuery} variables={{}}>
          {data => children(toAutoTopUpStatus(data.autoTopUpSettings))}
        </QueryIsland>
      </Suspense>
    </ContentErrorBoundary>
  );
}
