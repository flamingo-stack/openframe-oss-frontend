'use client';

import { useLayoutEffect, useMemo } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { needsYouSoftwareSourceQuery as NeedsYouSoftwareSourceQueryType } from '@/__generated__/needsYouSoftwareSourceQuery.graphql';
import { useRetryKey } from '@/app/components/shared/content-error-boundary';
import { failedSoftwareActionRow, NEEDS_YOU_CAPS, type ReportSource } from './needs-you-rows';

/** Software install / update runs that FAILED, newest first (the list's own order). */
const needsYouSoftwareSourceQuery = graphql`
  query needsYouSoftwareSourceQuery($first: Int!) {
    softwareActions(filter: { statuses: [FAILED] }, first: $first) {
      edges {
        node {
          id
          software
          action
          engine
          respondedMachineCount
          totalMachineCount
        }
      }
    }
  }
`;

/** Reports `software`; renders nothing. */
export function NeedsYouSoftwareSource({ onReport }: { onReport: ReportSource }) {
  const retryKey = useRetryKey();
  const data = useLazyLoadQuery<NeedsYouSoftwareSourceQueryType>(
    needsYouSoftwareSourceQuery,
    { first: NEEDS_YOU_CAPS.software },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );

  // Memoized for the effect below, which reports only when the rows actually change.
  const rows = useMemo(
    () =>
      data.softwareActions.edges.map(({ node }) =>
        failedSoftwareActionRow({
          id: node.id,
          software: node.software,
          action: node.action,
          engine: node.engine,
          respondedMachineCount: node.respondedMachineCount,
          totalMachineCount: node.totalMachineCount,
        }),
      ),
    [data.softwareActions.edges],
  );

  // Before paint: a source read from the store answers in the same commit, so a return to
  // the page draws its rows, not the card's loading form, for a frame.
  useLayoutEffect(() => {
    onReport('software', { status: 'ready', rows });
  }, [onReport, rows]);

  return null;
}
