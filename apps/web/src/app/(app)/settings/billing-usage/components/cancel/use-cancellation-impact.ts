'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { fleetApiClient } from '@/lib/fleet-api-client';

// Tickets live on the ai-agent GraphQL endpoint, not the main /api/graphql
// schema — raw POST is the rule there, not a leftover (see CLAUDE.md).
const TICKETS_GRAPHQL_ENDPOINT = '/chat/graphql';

const TICKETS_TOTAL_QUERY = `
  query CancellationTicketTotal {
    ticketStatistics {
      totalCount
    }
  }
`;

interface GraphQlEnvelope<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

/** The counts the main schema does not carry — see `DataLossBox` for the ones it does. */
export interface ExternalCancellationImpact {
  /** Total tickets across every status (active, on-hold, resolved, …). */
  tickets: number;
  monitoringPolicies: number;
  savedQueries: number;
}

async function fetchTicketsTotal(): Promise<number> {
  // `totalCount` is computed from the lifecycle status counts on the backend;
  // the legacy `statusCounts` this used to sum has come back empty since the
  // custom-status lifecycle shipped, so this figure always showed 0.
  const res = await apiClient.post<GraphQlEnvelope<{ ticketStatistics?: { totalCount?: number } }>>(
    TICKETS_GRAPHQL_ENDPOINT,
    { query: TICKETS_TOTAL_QUERY },
  );
  if (!res.ok || res.data?.errors?.length) {
    throw new Error(res.error || res.data?.errors?.[0]?.message || 'Failed to load ticket total');
  }
  return res.data?.data?.ticketStatistics?.totalCount ?? 0;
}

/**
 * Best-effort "what you'll lose" counts from the two transports Relay does not
 * reach: the ai-agent's GraphQL (tickets) and Fleet's REST (policies, queries).
 * Each is settled independently so one failing source still shows the rest.
 * Read-only ancillary data, so failures degrade to 0 silently rather than
 * toasting. `undefined` until all three have answered.
 */
export function useCancellationImpact(): ExternalCancellationImpact | undefined {
  const query = useQuery<ExternalCancellationImpact>({
    queryKey: ['cancellation-impact'],
    staleTime: 60_000,
    queryFn: async () => {
      const [tickets, policies, queries] = await Promise.allSettled([
        fetchTicketsTotal(),
        fleetApiClient.getPoliciesCount(),
        fleetApiClient.getQueriesCount(),
      ]);

      return {
        tickets: tickets.status === 'fulfilled' ? tickets.value : 0,
        monitoringPolicies:
          policies.status === 'fulfilled' && policies.value.ok ? (policies.value.data?.count ?? 0) : 0,
        savedQueries: queries.status === 'fulfilled' && queries.value.ok ? (queries.value.data?.count ?? 0) : 0,
      };
    },
  });

  return query.data;
}
