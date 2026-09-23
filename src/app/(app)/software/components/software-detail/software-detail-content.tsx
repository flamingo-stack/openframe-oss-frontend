'use client';

import { NotFoundError } from '@flamingo-stack/openframe-frontend-core';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { softwareDetailContentQuery as SoftwareDetailContentQueryType } from '@/__generated__/softwareDetailContentQuery.graphql';
import { CONTEXT_ENTITY_KIND } from '@/app/(app)/mingo/context/context-types';
import { useTrackOpenView } from '@/app/(app)/mingo/context/use-track-open-view';
import { useRetryKey } from '@/app/components/shared';
import { SoftwareDetailHeader } from './software-detail-header';
import { SoftwareDetailSummary } from './software-detail-summary';

/**
 * One software title — the header and the summary card. The two tabs fetch
 * their own lists by id, so they are not in here: the view mounts them beside
 * this island rather than behind it.
 *
 * `software(id:)` is nullable: a bad or stale id resolves to null rather than
 * throwing, which is what the page reports as "not found".
 */
const softwareDetailContentQuery = graphql`
  query softwareDetailContentQuery($id: ID!) {
    software(id: $id) {
      # What the page reports to Mingo as the open view — the name it is
      # chosen by in the picker.
      name
      ...softwareDetailHeader_software
      ...softwareDetailSummary_software
    }
  }
`;

/**
 * Everything on the page that waits for the record. The summary is the page's
 * not-found report; the tabs below it answer for themselves, with empty lists.
 */
export function SoftwareDetailContent({ softwareId }: { softwareId: string }) {
  const retryKey = useRetryKey();
  const { software } = useLazyLoadQuery<SoftwareDetailContentQueryType>(
    softwareDetailContentQuery,
    { id: softwareId },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );

  // Register this title as the Mingo "open view" so the agent gets the user's
  // working context on the next message (cleared on unmount → recent views).
  // The route's id is the inventory's own, the one the mention carries.
  useTrackOpenView(
    software ? { type: CONTEXT_ENTITY_KIND.SOFTWARE, id: softwareId, label: software.name || softwareId } : null,
  );

  return (
    <>
      <SoftwareDetailHeader software={software} />
      {software ? <SoftwareDetailSummary software={software} /> : <NotFoundError message="Software not found" />}
    </>
  );
}
