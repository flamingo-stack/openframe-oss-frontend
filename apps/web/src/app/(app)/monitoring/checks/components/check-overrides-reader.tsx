'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { ReactNode } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { checkOverridesReaderQuery as CheckOverridesReaderQueryType } from '@/__generated__/checkOverridesReaderQuery.graphql';
import { ContentErrorBoundary } from '@/app/components/shared';
import { type CheckOverride, toCheckWithOverrides } from '../utils/check-transform';

/** A check's exceptions: the same read as its page's, so a modal opened from the list finds them in the store. */
const checkOverridesReaderQuery = graphql`
  query checkOverridesReaderQuery($check: String!) {
    insightCheck(check: $check) {
      ...checkTransform_withOverrides
    }
  }
`;

interface CheckOverridesReaderProps {
  check: string;
  /** Drawn with the check's overrides; with null while they load or when they could not be read. */
  children: (overrides: readonly CheckOverride[] | null) => ReactNode;
}

/**
 * A check's overrides for a modal opened from the list (the check page has them already): Add
 * Override needs them to catch a scope that has one, Turn Off and Edit Default to name them.
 */
export function CheckOverridesReader({ check, children }: CheckOverridesReaderProps) {
  return (
    <ContentErrorBoundary fallback={() => children(null)}>
      <CheckOverridesReaderIsland check={check}>{children}</CheckOverridesReaderIsland>
    </ContentErrorBoundary>
  );
}

function CheckOverridesReaderIsland({ check, children }: CheckOverridesReaderProps) {
  return (
    <LoadingSuspense label="Loading exceptions">
      <CheckOverridesScope check={check}>{children}</CheckOverridesScope>
    </LoadingSuspense>
  );
}

function CheckOverridesScope({ check, children }: CheckOverridesReaderProps) {
  if (useLoadingScope()) return children(null);
  return <CheckOverridesReaderLive check={check}>{children}</CheckOverridesReaderLive>;
}

function CheckOverridesReaderLive({ check, children }: CheckOverridesReaderProps) {
  const data = useLazyLoadQuery<CheckOverridesReaderQueryType>(
    checkOverridesReaderQuery,
    { check },
    { fetchPolicy: 'store-or-network' },
  );
  return children(toCheckWithOverrides(data.insightCheck).overrides);
}
