'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { ReactNode } from 'react';
import { useLazyLoadQuery } from 'react-relay';
import type { insightCheckPageQuery as CheckPageQueryType } from '@/__generated__/insightCheckPageQuery.graphql';
import { ContentErrorBoundary } from '@/app/components/shared';
import { insightCheckPageQuery } from '@/graphql/insights/insight-check-page-query';
import { type CheckOverride, toCheckOverride } from '../utils/check-transform';

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
      <CheckOverridesReaderScope check={check}>{children}</CheckOverridesReaderScope>
    </LoadingSuspense>
  );
}

function CheckOverridesReaderScope({ check, children }: CheckOverridesReaderProps) {
  if (useLoadingScope()) return children(null);
  return <CheckOverridesReaderLive check={check}>{children}</CheckOverridesReaderLive>;
}

function CheckOverridesReaderLive({ check, children }: CheckOverridesReaderProps) {
  const data = useLazyLoadQuery<CheckPageQueryType>(
    insightCheckPageQuery,
    { check },
    { fetchPolicy: 'store-or-network' },
  );
  return children(data.insightCheck.overrides.map(toCheckOverride));
}
