'use client';

import { useCallback, useMemo } from 'react';
import { useLazyLoadQuery, usePaginationFragment } from 'react-relay';
import type { scheduleExecutionsRelay_query$key as ScheduleExecutionsFragmentKey } from '@/__generated__/scheduleExecutionsRelay_query.graphql';
import type { scheduleExecutionsRelayPaginationQuery as ScheduleExecutionsPaginationQueryType } from '@/__generated__/scheduleExecutionsRelayPaginationQuery.graphql';
import type { scheduleExecutionsRelayQuery as ScheduleExecutionsQueryType } from '@/__generated__/scheduleExecutionsRelayQuery.graphql';
import {
  scheduleExecutionsRelayFragment,
  scheduleExecutionsRelayQuery,
} from '@/graphql/scripts/schedule-executions-relay';
import {
  EXECUTIONS_PAGE_SIZE,
  ExecutionsTable,
  ExecutionsTabShell,
  type ExecutionsTabState,
  toUiExecution,
  type UiExecution,
  useExecutionFacetOptions,
} from './executions-table';

interface ScheduleExecutionsTabProps {
  scheduleId: string;
}

function ScheduleExecutionsContent({ scheduleId, state }: { scheduleId: string; state: ExecutionsTabState }) {
  const { backendFilters, debouncedSearch, ...tableState } = state;

  // One round-trip per interaction: the facets (`scheduleExecutionFilters`)
  // ride the list operation — see the query docstring for the facet semantics.
  const queryData = useLazyLoadQuery<ScheduleExecutionsQueryType>(
    scheduleExecutionsRelayQuery,
    { scheduleId, filter: backendFilters, search: debouncedSearch || null, first: EXECUTIONS_PAGE_SIZE, after: null },
    { fetchPolicy: 'store-and-network' },
  );

  const facetOptions = useExecutionFacetOptions(queryData.scheduleExecutionFilters);

  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    ScheduleExecutionsPaginationQueryType,
    ScheduleExecutionsFragmentKey
  >(scheduleExecutionsRelayFragment, queryData);

  const executions: UiExecution[] = useMemo(() => {
    const edges = data.scheduleExecutions?.edges ?? [];
    // Defensive null-node guard: skip any dangling edge instead of crashing the
    // tab on a store-evicted record.
    return edges.flatMap(edge => (edge?.node ? [toUiExecution(edge.node)] : []));
  }, [data.scheduleExecutions?.edges]);

  const fetchNextPage = useCallback(() => {
    if (hasNext && !isLoadingNext) loadNext(EXECUTIONS_PAGE_SIZE);
  }, [hasNext, isLoadingNext, loadNext]);

  return (
    <ExecutionsTable
      executions={executions}
      facetOptions={facetOptions}
      search={debouncedSearch}
      emptyHint="No executions yet. Once this schedule fires, every device it ran on shows up here."
      hasNext={hasNext}
      isLoadingNext={isLoadingNext}
      onLoadMore={fetchNextPage}
      {...tableState}
    />
  );
}

/**
 * Execution History for a schedule — the flat per-device history across all of
 * its runs (`scheduleExecutions(scheduleId:)`). Same rows, columns and filters
 * as the per-script tab; the Runs tab is the aggregate view above it.
 */
export function ScheduleExecutionsTab({ scheduleId }: ScheduleExecutionsTabProps) {
  return (
    <ExecutionsTabShell>
      {state => <ScheduleExecutionsContent scheduleId={scheduleId} state={state} />}
    </ExecutionsTabShell>
  );
}
