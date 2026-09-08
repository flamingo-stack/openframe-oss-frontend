'use client';

import { useDebounce } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { ticketService } from '@/app/(app)/tickets/services';
import { useTicketStatusesQuery } from '@/app/(app)/tickets/statuses/hooks/use-ticket-statuses-query';
import { TICKET_STATUS_KIND } from '@/app/(app)/tickets/utils/ticket-statistics';
import { postGraphQl } from './graphql';
import type { AssignmentTargetType } from './types';

const PAGE_SIZE = 20;

export interface AssignmentSearchOption {
  label: string;
  value: string;
}

interface ConnectionEdges<T> {
  edges: Array<{ node: T }>;
}

const ORGANIZATIONS_SEARCH_QUERY = `#graphql
  query AssignmentsOrganizationsSearch($search: String, $first: Int) {
    organizations(search: $search, first: $first) { edges { node { id name } } }
  }
`;

// Deliberately lean, and deliberately NOT the shared `fetchDevicesPage`: this is
// a per-keystroke type-ahead that renders a label, while the shared device
// document carries the full list row (organization + contact fan-out,
// toolConnections, tags). Its three siblings above and below keep their own
// documents for the same reason.
const DEVICES_SEARCH_QUERY = `#graphql
  query AssignmentsDevicesSearch($search: String, $first: Int) {
    devices(search: $search, first: $first) { edges { node { id hostname displayName } } }
  }
`;

const KNOWLEDGE_ARTICLES_TREE_QUERY = `#graphql
  query AssignmentsKnowledgeArticleTree {
    knowledgeBaseArticleTree { id name }
  }
`;

const fetchCustomers = async (search: string): Promise<AssignmentSearchOption[]> => {
  const data = await postGraphQl<{ organizations: ConnectionEdges<{ id: string; name: string }> }>(
    ORGANIZATIONS_SEARCH_QUERY,
    { search, first: PAGE_SIZE },
  );
  return data.organizations.edges.map(({ node }) => ({ value: node.id, label: node.name }));
};

const fetchDevices = async (search: string): Promise<AssignmentSearchOption[]> => {
  const data = await postGraphQl<{
    devices: ConnectionEdges<{ id: string; hostname: string | null; displayName: string | null }>;
  }>(DEVICES_SEARCH_QUERY, { search, first: PAGE_SIZE });
  return data.devices.edges.map(({ node }) => ({
    value: node.id,
    label: node.displayName || node.hostname || node.id,
  }));
};

const fetchTickets = async (search: string, statusIds: string[]): Promise<AssignmentSearchOption[]> => {
  const page = await ticketService.fetchDialogs({
    statusIds,
    search: search || undefined,
    limit: PAGE_SIZE,
  });
  return page.dialogs.map(d => ({
    value: d.id,
    label: d.title || (d.ticketNumber ? `#${d.ticketNumber}` : d.id),
  }));
};

const fetchKnowledgeArticles = async (): Promise<AssignmentSearchOption[]> => {
  const data = await postGraphQl<{ knowledgeBaseArticleTree: Array<{ id: string; name: string }> }>(
    KNOWLEDGE_ARTICLES_TREE_QUERY,
    {},
  );
  return data.knowledgeBaseArticleTree.map(node => ({ value: node.id, label: node.name }));
};

// TICKET is not in this map: its fetcher also needs the non-archived lifecycle
// status ids, resolved from the shared status snapshot in useServerSearchOptions.
const SERVER_SEARCH_FETCHERS: Partial<
  Record<AssignmentTargetType, (search: string) => Promise<AssignmentSearchOption[]>>
> = {
  ORGANIZATION: fetchCustomers,
  DEVICE: fetchDevices,
};

const EMPTY_OPTIONS: AssignmentSearchOption[] = [];

function useServerSearchOptions(
  targetType: AssignmentTargetType,
  search: string,
): { options: AssignmentSearchOption[]; isLoading: boolean } {
  const debouncedSearch = useDebounce(search, 300);
  const fetcher = SERVER_SEARCH_FETCHERS[targetType];
  // The ticket search scopes to non-archived tickets by lifecycle status id
  // (the API takes no status enum), so it waits for the status snapshot —
  // cached and shared with the tickets pages.
  const isTicket = targetType === 'TICKET';
  const statusesQuery = useTicketStatusesQuery({ enabled: isTicket });
  const nonArchivedStatusIds = useMemo(
    () => statusesQuery.data?.snapshot.filter(s => s.kind !== TICKET_STATUS_KIND.ARCHIVED).map(s => s.id),
    [statusesQuery.data],
  );
  const query = useQuery({
    queryKey: ['assignments', 'search', targetType, debouncedSearch, isTicket ? nonArchivedStatusIds : undefined],
    queryFn: () => {
      if (isTicket) return fetchTickets(debouncedSearch, nonArchivedStatusIds ?? []);
      return fetcher ? fetcher(debouncedSearch) : Promise.resolve(EMPTY_OPTIONS);
    },
    enabled: isTicket ? !!nonArchivedStatusIds?.length : !!fetcher,
    staleTime: 30_000,
  });
  return {
    options: query.data ?? EMPTY_OPTIONS,
    isLoading: query.isLoading || (isTicket && statusesQuery.isLoading),
  };
}

function useKnowledgeArticleOptions(search: string): { options: AssignmentSearchOption[]; isLoading: boolean } {
  const query = useQuery({
    queryKey: ['assignments', 'search', 'KNOWLEDGE_ARTICLE'],
    queryFn: fetchKnowledgeArticles,
    staleTime: 30_000,
  });
  const debouncedSearch = useDebounce(search, 300);
  const options = useMemo(() => {
    const all = query.data ?? EMPTY_OPTIONS;
    const needle = debouncedSearch.trim().toLowerCase();
    if (!needle) return all;
    return all.filter(opt => opt.label.toLowerCase().includes(needle));
  }, [query.data, debouncedSearch]);
  return { options, isLoading: query.isLoading };
}

export function useAssignmentSearch(
  targetType: AssignmentTargetType,
  search: string,
): { options: AssignmentSearchOption[]; isLoading: boolean } {
  const articleResult = useKnowledgeArticleOptions(search);
  const serverResult = useServerSearchOptions(targetType, search);
  return targetType === 'KNOWLEDGE_ARTICLE' ? articleResult : serverResult;
}
