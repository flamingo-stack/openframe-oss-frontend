'use client';

import { NotFoundError } from '@flamingo-stack/openframe-frontend-core';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { softwareDetailContentQuery as SoftwareDetailContentQueryType } from '@/__generated__/softwareDetailContentQuery.graphql';
import { useRetryKey } from '@/app/components/shared';
import { SoftwareDetailHeader } from './software-detail-header';
import { SoftwareDetailSummary } from './software-detail-summary';
import { SoftwareDetailTabs } from './software-detail-tabs';

/**
 * One software title — the header and the summary card. The two tabs fetch
 * their own lists by id.
 *
 * `software(id:)` is nullable: a bad or stale id resolves to null rather than
 * throwing, which is what the page reports as "not found".
 */
const softwareDetailContentQuery = graphql`
  query softwareDetailContentQuery($id: ID!) {
    software(id: $id) {
      ...softwareDetailHeader_software
      ...softwareDetailSummary_software
    }
  }
`;

/**
 * Everything on the page that waits for the record. The summary is the page's
 * single not-found report, so a bad id is stated once instead of by every tab.
 */
export function SoftwareDetailContent({ softwareId }: { softwareId: string }) {
  const retryKey = useRetryKey();
  const { software } = useLazyLoadQuery<SoftwareDetailContentQueryType>(
    softwareDetailContentQuery,
    { id: softwareId },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );

  return (
    <>
      <SoftwareDetailHeader software={software} />

      <div className="flex flex-1 flex-col gap-[var(--spacing-system-l)]">
        {software ? <SoftwareDetailSummary software={software} /> : <NotFoundError message="Software not found" />}

        {/* `TabNavigation` renders as a fragment, so its bar and its body are
            siblings — grouped into ONE flex item here so the column's gap can't
            push them apart. Each tab body owns the padding under the bar. */}
        {software && (
          <div className="flex flex-col">
            <SoftwareDetailTabs softwareId={softwareId} />
          </div>
        )}
      </div>
    </>
  );
}
