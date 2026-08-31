'use client';

import { ClipboardListIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { memo, useCallback, useMemo } from 'react';
import { useLazyLoadQuery, usePaginationFragment } from 'react-relay';
import type { scriptExecutionsRelay_query$key as ExecutionsFragmentKey } from '@/__generated__/scriptExecutionsRelay_query.graphql';
import type { scriptExecutionsRelayPaginationQuery as ExecutionsPaginationQueryType } from '@/__generated__/scriptExecutionsRelayPaginationQuery.graphql';
import type { scriptExecutionsRelayQuery as ExecutionsQueryType } from '@/__generated__/scriptExecutionsRelayQuery.graphql';
import { useRetryKey } from '@/app/components/shared';
import { scriptExecutionsRelayFragment, scriptExecutionsRelayQuery } from '@/graphql/scripts/script-executions-relay';
import {
  EXECUTIONS_PAGE_SIZE,
  ExecutionsTable,
  ExecutionsTabShell,
  type ExecutionsTabState,
  narrowExecutions,
  toUiExecution,
  type UiExecution,
  useExecutionFacetOptions,
} from '../../shared/components/executions-table';

/** The schedule tab's placeholder (design 1:48878), named for one script. */
const EMPTY_STATE = {
  icon: <ClipboardListIcon />,
  title: 'No Execution History',
  description: 'Runs of this script will be displayed here',
};

interface ScriptExecutionsTabProps {
  scriptId: string;
}

// ----------------------------------------------------------------
// Relay content — must live inside the shell's Suspense boundary
// ----------------------------------------------------------------

function ScriptExecutionsContent({ scriptId, state }: { scriptId: string; state: ExecutionsTabState }) {
  const { backendFilters, sort, querySearch, narrowSearch, ...tableState } = state;

  // One round-trip per interaction: the filter facets (`scriptExecutionFilters`)
  // ride the list operation — see the query docstring for the facet semantics.
  const retryKey = useRetryKey();
  const queryData = useLazyLoadQuery<ExecutionsQueryType>(
    scriptExecutionsRelayQuery,
    { scriptId, filter: backendFilters, search: querySearch || null, sort, first: EXECUTIONS_PAGE_SIZE, after: null },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
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
    const rows = edges.flatMap(edge => (edge?.node ? [toUiExecution(edge.node)] : []));
    // A no-op here — this list's search reaches the server, so `narrowSearch` is
    // always empty. Kept so every caller of the shell honours the same contract.
    return narrowExecutions(rows, narrowSearch);
  }, [data.scriptExecutions?.edges, narrowSearch]);

  const fetchNextPage = useCallback(() => {
    if (hasNext && !isLoadingNext) loadNext(EXECUTIONS_PAGE_SIZE);
  }, [hasNext, isLoadingNext, loadNext]);

  return (
    <ExecutionsTable
      executions={executions}
      facetOptions={facetOptions}
      search={querySearch}
      emptyState={EMPTY_STATE}
      hasNext={hasNext}
      isLoadingNext={isLoadingNext}
      onLoadMore={fetchNextPage}
      {...tableState}
    />
  );
}

/**
 * Execution history for a single script — `scriptExecutions(scriptId:)`.
 *
 * The boundary lives inside `ExecutionsTabShell`, BELOW the toolbar, so a filter
 * change reloads the rows and leaves the search box where it was.
 *
 * `memo` for the reason given in `script-detail-tabs.ts`.
 */
export const ScriptExecutionsTab = memo(function ScriptExecutionsTab({ scriptId }: ScriptExecutionsTabProps) {
  return (
    <ExecutionsTabShell>{state => <ScriptExecutionsContent scriptId={scriptId} state={state} />}</ExecutionsTabShell>
  );
});
