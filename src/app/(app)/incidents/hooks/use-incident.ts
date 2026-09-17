'use client';

import { useLazyLoadQuery } from 'react-relay';
import type { incidentDetailRelayQuery as IncidentDetailQueryType } from '@/__generated__/incidentDetailRelayQuery.graphql';
import { useRetryKey } from '@/app/components/shared';
import { incidentDetailRelayQuery } from '@/graphql/insights/incident-detail-relay';
import { type Incident, toIncident } from '../utils/incident-transform';

/**
 * The detail page's record, for every island that draws it. One place for the
 * variables and fetch policy: the header and the body each call this, and
 * Relay dedupes the two into one request only while they ask for exactly the
 * same thing. The shared `useRetryKey` matters too — a sibling left unkeyed
 * replays a retained rejection after Retry (see `ScriptSummary`).
 */
export function useIncident(incidentId: string): Incident {
  const retryKey = useRetryKey();
  const data = useLazyLoadQuery<IncidentDetailQueryType>(
    incidentDetailRelayQuery,
    { id: incidentId },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );
  return toIncident(data.insight);
}
