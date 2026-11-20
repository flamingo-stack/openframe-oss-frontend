'use client';

import { ClipboardListIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { memo, useMemo } from 'react';
import { useLazyLoadQuery } from 'react-relay';
import type { scheduleExecutionsRelayPagedQuery as ScheduleExecutionsQueryType } from '@/__generated__/scheduleExecutionsRelayPagedQuery.graphql';
import { useRetryKey } from '@/app/components/shared';
import { usePagedTable } from '@/app/hooks/use-paged-table';
import { useRefetchPage } from '@/app/hooks/use-refetch-page';
import { scheduleExecutionsRelayPagedQuery } from '@/graphql/scripts/schedule-executions-relay';
import {
  type ExecutionsPaging,
  ExecutionsTable,
  ExecutionsTabShell,
  type PagedExecutionsTabState,
  toUiExecution,
  type UiExecution,
  useExecutionFacetOptions,
} from '../../shared/components/executions-table';

/** Design 1:48878 — the placeholder for a schedule that has never fired. */
const EMPTY_STATE = {
  icon: <ClipboardListIcon />,
  title: 'No Execution History',
  description: 'Script execution logs will be displayed here',
};

/**
 * The tab's params live under the `exec` prefix (`execSearch`, `execStatus`, `execMachineId`, `execInitiatorId`,
 * `execDateFrom`, `execDateTo`, `execSortDir`, `execCursor`, `execPage`, `execDir`): the schedule page's tabs share
 * its URL (Schedule Runs keeps `run…`). The list pages back on the server.
 */
const PAGING: ExecutionsPaging = { prefix: 'exec', list: 'scheduleExecutions' };

interface ScheduleExecutionsTabProps {
  scheduleId: string;
}

function ScheduleExecutionsContent({ scheduleId, state }: { scheduleId: string; state: PagedExecutionsTabState }) {
  const { backendFilters, sort, querySearch, pager, pageVariables, paramPrefix, ...tableState } = state;

  // One page per request, its cursor in the URL; the facets (`scheduleExecutionFilters`) ride the same operation —
  // see the query docstring for the facet semantics.
  const retryKey = useRetryKey();
  const variables = {
    scheduleId,
    filter: backendFilters,
    search: querySearch || null,
    sort,
    ...pageVariables,
  };
  const data = useLazyLoadQuery<ScheduleExecutionsQueryType>(scheduleExecutionsRelayPagedQuery, variables, {
    fetchPolicy: 'store-and-network',
    fetchKey: retryKey,
  });
  const refetch = useRefetchPage<ScheduleExecutionsQueryType>(scheduleExecutionsRelayPagedQuery, variables);

  const facetOptions = useExecutionFacetOptions(data.scheduleExecutionFilters);

  const edges = data.scheduleExecutions?.edges;
  // Defensive null-node guard: skip any dangling edge instead of crashing the
  // tab on a store-evicted record.
  // `scriptName` rides beside the shared row fragment on this list only — a
  // schedule runs several scripts, so the rows say which one they were.
  const executions: UiExecution[] = useMemo(
    () => (edges ?? []).flatMap(edge => (edge?.node ? [toUiExecution(edge.node, edge.node.scriptName)] : [])),
    [edges],
  );

  const paged = usePagedTable({
    pager,
    pageInfo: data.scheduleExecutions?.pageInfo,
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
      totalCount={data.scheduleExecutions?.filteredCount ?? undefined}
      pager={paged.pager}
      refresh={paged.refresh}
      {...tableState}
    />
  );
}

/**
 * Execution History for a schedule — the flat per-device history across all of
 * its runs (`scheduleExecutions(scheduleId:)`), one page at a time with
 * First · Prev · Next. Same rows, columns and filters as the per-script tab;
 * the Runs tab is the aggregate view above it.
 *
 * The boundary lives inside `ExecutionsTabShell`, BELOW the toolbar, so a filter
 * change reloads the rows and leaves the search box where it was.
 *
 * `memo` for the reason given in `schedule-detail-tabs.ts`.
 */
export const ScheduleExecutionsTab = memo(function ScheduleExecutionsTabImpl({
  scheduleId,
}: ScheduleExecutionsTabProps) {
  return (
    <ExecutionsTabShell paging={PAGING}>
      {state => <ScheduleExecutionsContent scheduleId={scheduleId} state={state} />}
    </ExecutionsTabShell>
  );
});
ScheduleExecutionsTab.displayName = 'ScheduleExecutionsTab';
