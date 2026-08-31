'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { fleetApiClient } from '@/lib/fleet-api-client';

// Tickets live on the ai-agent GraphQL endpoint, not the main /api/graphql schema.
const TICKETS_GRAPHQL_ENDPOINT = '/chat/graphql';
const MAIN_GRAPHQL_ENDPOINT = '/api/graphql';

const TICKETS_TOTAL_QUERY = `
  query CancellationTicketTotal {
    ticketStatistics {
      statusCounts {
        status
        count
      }
    }
  }
`;

/**
 * Articles and the folders they are filed in, in one round trip — the dialog
 * states them as one sentence ("N articles across M folders"), so fetching them
 * apart would let it print half of it.
 *
 * NOT `knowledgeBaseItems(filter: { type: … }).filteredCount`, which is what this
 * asked first and which answered "0 articles, 21 folders" on a tenant full of
 * both. That connection is scoped to ONE level: with no `parentId` it lists the
 * root, so everything filed inside a folder — i.e. the entire knowledge base —
 * was invisible to it. Counting the tenant that way needs a walk: one request per
 * folder, and a recursion whose depth nobody bounds.
 *
 * The two `*Tree` queries are the API's own answer to that. They are already flat
 * — `knowledgeBaseFolderTree` is what the move-to-folder picker reads to offer
 * every folder at any depth, and it builds the hierarchy client-side from
 * `parentId` — so the whole set arrives in one response and the count is its
 * length. Selecting only `id` keeps that response to a list of strings; the
 * article bodies these nodes can carry never leave the server.
 */
const KB_QUERY = `
  query CancellationKnowledgeBase {
    articles: knowledgeBaseArticleTree {
      id
    }
    folders: knowledgeBaseFolderTree {
      id
    }
  }
`;

// ACTIVE only — the default (null statuses) also counts ARCHIVED scripts, which
// aren't "data you'll lose" in the same sense. Same for the schedules attached
// to them: an archived schedule is not going to run again either way.
const SCRIPTS_QUERY = `
  query CancellationScripts {
    scripts(filter: { statuses: [ACTIVE] }, first: 1) {
      filteredCount
    }
    scriptSchedules(filter: { statuses: [ACTIVE] }, first: 1) {
      filteredCount
    }
  }
`;

interface GraphQlEnvelope<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

interface CancellationImpact {
  /** Total tickets across every status (active, on-hold, resolved, …). */
  tickets: number;
  kbArticles: number;
  /** Folders those articles are filed in — named beside the article count. */
  kbFolders: number;
  scripts: number;
  /** Schedules that would still have fired — named beside the script count. */
  activeSchedules: number;
  monitoringPolicies: number;
  savedQueries: number;
}

async function fetchTicketsTotal(): Promise<number> {
  const res = await apiClient.post<GraphQlEnvelope<{ ticketStatistics?: { statusCounts?: Array<{ count: number }> } }>>(
    TICKETS_GRAPHQL_ENDPOINT,
    { query: TICKETS_TOTAL_QUERY },
  );
  if (!res.ok || res.data?.errors?.length) {
    throw new Error(res.error || res.data?.errors?.[0]?.message || 'Failed to load ticket total');
  }
  const counts = res.data?.data?.ticketStatistics?.statusCounts ?? [];
  return counts.reduce((sum, sc) => sum + (sc.count ?? 0), 0);
}

interface KnowledgeBaseTrees {
  articles?: Array<{ id: string }>;
  folders?: Array<{ id: string }>;
}

async function fetchKnowledgeBase(): Promise<{ articles: number; folders: number }> {
  const res = await apiClient.post<GraphQlEnvelope<KnowledgeBaseTrees>>(MAIN_GRAPHQL_ENDPOINT, { query: KB_QUERY });
  if (!res.ok || res.data?.errors?.length) {
    throw new Error(res.error || res.data?.errors?.[0]?.message || 'Failed to load knowledge base count');
  }
  return {
    articles: res.data?.data?.articles?.length ?? 0,
    folders: res.data?.data?.folders?.length ?? 0,
  };
}

interface ScriptCounts {
  scripts?: { filteredCount: number };
  scriptSchedules?: { filteredCount: number };
}

async function fetchScriptCounts(): Promise<{ scripts: number; schedules: number }> {
  const res = await apiClient.post<GraphQlEnvelope<ScriptCounts>>(MAIN_GRAPHQL_ENDPOINT, { query: SCRIPTS_QUERY });
  if (!res.ok || res.data?.errors?.length) {
    throw new Error(res.error || res.data?.errors?.[0]?.message || 'Failed to load scripts count');
  }
  return {
    scripts: res.data?.data?.scripts?.filteredCount ?? 0,
    schedules: res.data?.data?.scriptSchedules?.filteredCount ?? 0,
  };
}

/**
 * Best-effort "what you'll lose" counts for the cancellation modal. Sourced from three
 * transports (ai-agent GraphQL, main GraphQL, Fleet REST); each is settled independently so
 * one failing source still shows the rest. Fetched lazily — only while the modal is open.
 * Read-only ancillary data, so failures degrade to 0 silently rather than toasting.
 */
export function useCancellationImpact({ enabled }: { enabled: boolean }) {
  const query = useQuery<CancellationImpact>({
    queryKey: ['cancellation-impact'],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const [tickets, knowledgeBase, scripts, policies, queries] = await Promise.allSettled([
        fetchTicketsTotal(),
        fetchKnowledgeBase(),
        fetchScriptCounts(),
        fleetApiClient.getPoliciesCount(),
        fleetApiClient.getQueriesCount(),
      ]);

      return {
        tickets: tickets.status === 'fulfilled' ? tickets.value : 0,
        kbArticles: knowledgeBase.status === 'fulfilled' ? knowledgeBase.value.articles : 0,
        kbFolders: knowledgeBase.status === 'fulfilled' ? knowledgeBase.value.folders : 0,
        scripts: scripts.status === 'fulfilled' ? scripts.value.scripts : 0,
        activeSchedules: scripts.status === 'fulfilled' ? scripts.value.schedules : 0,
        monitoringPolicies:
          policies.status === 'fulfilled' && policies.value.ok ? (policies.value.data?.count ?? 0) : 0,
        savedQueries: queries.status === 'fulfilled' && queries.value.ok ? (queries.value.data?.count ?? 0) : 0,
      };
    },
  });

  return { impact: query.data, isLoading: query.isLoading && enabled };
}
