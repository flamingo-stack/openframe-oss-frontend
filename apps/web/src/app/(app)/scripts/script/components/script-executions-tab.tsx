'use client';

import { ClipboardListIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { memo, useMemo } from 'react';
import { useLazyLoadQuery } from 'react-relay';
import type { scriptExecutionsRelayQuery as ExecutionsQueryType } from '@/__generated__/scriptExecutionsRelayQuery.graphql';
import { useRetryKey } from '@/app/components/shared';
import { usePagedTable } from '@/app/hooks/use-paged-table';
import { useRefetchPage } from '@/app/hooks/use-refetch-page';
import { scriptExecutionsRelayQuery } from '@/graphql/scripts/script-executions-relay';
import {
  type ExecutionsPaging,
  ExecutionsTable,
  ExecutionsTabShell,
  type PagedExecutionsTabState,
  toUiExecution,
  type UiExecution,
  useExecutionFacetOptions,
} from '../../shared/components/executions-table';
import { SCRIPTS_TABLE_SETTINGS } from '../../shared/utils/grid-columns';

/** The schedule tab's placeholder (design 1:48878), named for one script. */
const EMPTY_STATE = {
  icon: <ClipboardListIcon />,
  title: 'No Execution History',
  description: 'Runs of this script will be displayed here',
};

/**
 * The tab's params live under the `exec` prefix (`execSearch`, `execStatus`, `execMachineId`, `execInitiatorId`,
 * `execDateFrom`, `execDateTo`, `execSortDir`, `execCursor`, `execPage`, `execDir`): the script page's tabs share its
 * URL. The list pages back on the server.
 */
const PAGING: ExecutionsPaging = { prefix: 'exec', list: 'scriptExecutions' };

interface ScriptExecutionsTabProps {
  scriptId: string;
}

// ----------------------------------------------------------------
// Relay content — must live inside the shell's Suspense boundary
// ----------------------------------------------------------------

function ScriptExecutionsContent({ scriptId, state }: { scriptId: string; state: PagedExecutionsTabState }) {
  const { backendFilters, sort, querySearch, pager, pageVariables, paramPrefix, ...tableState } = state;

  // One page per request, its cursor in the URL; the filter facets (`scriptExecutionFilters`) ride the same
  // operation — see the query docstring for the facet semantics.
  const retryKey = useRetryKey();
  const variables = {
    scriptId,
    filter: backendFilters,
    search: querySearch || null,
    sort,
    ...pageVariables,
  };
  const data = useLazyLoadQuery<ExecutionsQueryType>(scriptExecutionsRelayQuery, variables, {
    fetchPolicy: 'store-and-network',
    fetchKey: retryKey,
  });
  const refetch = useRefetchPage<ExecutionsQueryType>(scriptExecutionsRelayQuery, variables);

  const facetOptions = useExecutionFacetOptions(data.scriptExecutionFilters);

  const edges = data.scriptExecutions?.edges;
  // Defensive null-node guard (same as scripts-table): skip any dangling edge
  // instead of crashing the tab on a store-evicted record.
  const executions: UiExecution[] = useMemo(
    () => (edges ?? []).flatMap(edge => (edge?.node ? [toUiExecution(edge.node)] : [])),
    [edges],
  );

  const paged = usePagedTable({
    pager,
    pageInfo: data.scriptExecutions?.pageInfo,
    rowCount: edges?.length ?? 0,
    prefix: paramPrefix,
    refetch,
    isPending: tableState.isPending,
  });

  return (
    <ExecutionsTable
      executions={executions}
      facetOptions={facetOptions}
      search={querySearch}
      emptyState={EMPTY_STATE}
      totalCount={data.scriptExecutions?.filteredCount ?? undefined}
      pager={paged.pager}
      refresh={paged.refresh}
      {...tableState}
    />
  );
}

/**
 * Execution history for a single script — `scriptExecutions(scriptId:)`, one page at a time with First · Prev · Next.
 *
 * The boundary lives inside `ExecutionsTabShell`, BELOW the toolbar, so a filter
 * change reloads the rows and leaves the search box where it was.
 *
 * `memo` for the reason given in `script-detail-tabs.ts`.
 */
export const ScriptExecutionsTab = memo(function ScriptExecutionsTabImpl({ scriptId }: ScriptExecutionsTabProps) {
  return (
    <ExecutionsTabShell paging={PAGING} tableSettings={SCRIPTS_TABLE_SETTINGS.scriptExecutions}>
      {state => <ScriptExecutionsContent scriptId={scriptId} state={state} />}
    </ExecutionsTabShell>
  );
});
ScriptExecutionsTab.displayName = 'ScriptExecutionsTab';
