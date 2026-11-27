'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { checkPageViewQuery as CheckPageViewQueryType } from '@/__generated__/checkPageViewQuery.graphql';
import { ContentErrorBoundary, useRetryKey } from '@/app/components/shared';
import { toCheckWithOverrides } from '../utils/check-transform';
import { CheckPageContent } from './check-page-content';

/** A check and every exception it has. */
const checkPageViewQuery = graphql`
  query checkPageViewQuery($check: String!) {
    insightCheck(check: $check) {
      ...checkTransform_withOverrides
    }
  }
`;

/** A built-in check's page: its default for every device and every exception that changes it. */
export function CheckPageView({ checkKey }: { checkKey: string }) {
  const retryKey = useRetryKey();
  return (
    <ContentErrorBoundary message="Couldn't load the check." resetKey={`${checkKey}:${retryKey}`}>
      <CheckPageIsland checkKey={checkKey} />
    </ContentErrorBoundary>
  );
}

function CheckPageIsland({ checkKey }: { checkKey: string }) {
  return (
    <LoadingSuspense label="Loading check">
      <CheckPageReader checkKey={checkKey} />
    </LoadingSuspense>
  );
}

function CheckPageReader({ checkKey }: { checkKey: string }) {
  if (useLoadingScope()) return <CheckPageContent />;
  return <CheckPageLive checkKey={checkKey} />;
}

function CheckPageLive({ checkKey }: { checkKey: string }) {
  // The boundary's Retry re-issues the request: a failed read is cached under its fetch key.
  const retryKey = useRetryKey();
  const data = useLazyLoadQuery<CheckPageViewQueryType>(
    checkPageViewQuery,
    { check: checkKey },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );
  const { check, overrides } = toCheckWithOverrides(data.insightCheck);
  return <CheckPageContent check={check} overrides={overrides} />;
}
