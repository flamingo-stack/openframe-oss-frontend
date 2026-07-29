'use client';

import { useCallback, useMemo } from 'react';
import { useLazyLoadQuery, usePaginationFragment } from 'react-relay';
import type { scriptExecutionsRelay_query$key as ExecutionsFragmentKey } from '@/__generated__/scriptExecutionsRelay_query.graphql';
import type { scriptExecutionsRelayPaginationQuery as ExecutionsPaginationQueryType } from '@/__generated__/scriptExecutionsRelayPaginationQuery.graphql';
import type { scriptExecutionsRelayQuery as ExecutionsQueryType } from '@/__generated__/scriptExecutionsRelayQuery.graphql';
import { scriptExecutionsRelayFragment, scriptExecutionsRelayQuery } from '@/graphql/scripts/script-executions-relay';
import {
  EXECUTIONS_PAGE_SIZE,
  ExecutionsTable,
  ExecutionsTabShell,
  type ExecutionsTabState,
  toUiExecution,
  type UiExecution,
  useExecutionFacetOptions,
} from './executions-table';

interface ScriptExecutionsTabProps {
  scriptId: string;
}

// ----------------------------------------------------------------
// Relay content — must live inside the shell's Suspense boundary
// ----------------------------------------------------------------

function ScriptExecutionsContent({ scriptId, state }: { scriptId: string; state: ExecutionsTabState }) {
  const { backendFilters, debouncedSearch, ...tableState } = state;

  // One round-trip per interaction: the filter facets (`scriptExecutionFilters`)
  // ride the list operation — see the query docstring for the facet semantics.
  const queryData = useLazyLoadQuery<ExecutionsQueryType>(
    scriptExecutionsRelayQuery,
    { scriptId, filter: backendFilters, search: debouncedSearch || null, first: EXECUTIONS_PAGE_SIZE, after: null },
    { fetchPolicy: 'store-and-network' },
  );

  const facetOptions = useExecutionFacetOptions(queryData.scriptExecutionFilters);

  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    ExecutionsPaginationQueryType,
    ExecutionsFragmentKey
  >(scriptExecutionsRelayFragment, queryData);

  const executions: UiExecution[] = useMemo(() => {
    const edges = data.scriptExecutions?.edges ?? [];
    // Defensive null-node guard (same as scripts-table): skip any dangling edge
    // instead of crashing the tab on a store-evicted record.
    return edges.flatMap(edge => (edge?.node ? [toUiExecution(edge.node)] : []));
  }, [data.scriptExecutions?.edges]);

  const fetchNextPage = useCallback(() => {
    if (hasNext && !isLoadingNext) loadNext(EXECUTIONS_PAGE_SIZE);
  }, [hasNext, isLoadingNext, loadNext]);

  return (
    <ExecutionsTable
      executions={executions}
      facetOptions={facetOptions}
      search={debouncedSearch}
      emptyHint="No executions found. Run this script to see its history here."
      hasNext={hasNext}
      isLoadingNext={isLoadingNext}
      onLoadMore={fetchNextPage}
      {...tableState}
    />
  );
}

/** Execution history for a single script — `scriptExecutions(scriptId:)`. */
export function ScriptExecutionsTab({ scriptId }: ScriptExecutionsTabProps) {
  return (
    <ExecutionsTabShell>{state => <ScriptExecutionsContent scriptId={scriptId} state={state} />}</ExecutionsTabShell>
  );
}
