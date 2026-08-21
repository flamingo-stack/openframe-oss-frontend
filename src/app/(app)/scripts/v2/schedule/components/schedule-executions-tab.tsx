'use client';

import { ClipboardListIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { memo, useCallback, useMemo } from 'react';
import { useLazyLoadQuery, usePaginationFragment } from 'react-relay';
import type { scheduleExecutionsRelay_query$key as ScheduleExecutionsFragmentKey } from '@/__generated__/scheduleExecutionsRelay_query.graphql';
import type { scheduleExecutionsRelayPaginationQuery as ScheduleExecutionsPaginationQueryType } from '@/__generated__/scheduleExecutionsRelayPaginationQuery.graphql';
import type { scheduleExecutionsRelayQuery as ScheduleExecutionsQueryType } from '@/__generated__/scheduleExecutionsRelayQuery.graphql';
import { useRetryKey } from '@/app/components/shared';
import {
  scheduleExecutionsRelayFragment,
  scheduleExecutionsRelayQuery,
} from '@/graphql/scripts/schedule-executions-relay';
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

/** Design 1:48878 — the placeholder for a schedule that has never fired. */
const EMPTY_STATE = {
  icon: <ClipboardListIcon />,
  title: 'No Execution History',
  description: 'Script execution logs will be displayed here',
};

interface ScheduleExecutionsTabProps {
  scheduleId: string;
}

function ScheduleExecutionsContent({ scheduleId, state }: { scheduleId: string; state: ExecutionsTabState }) {
  const { backendFilters, sort, querySearch, narrowSearch, ...tableState } = state;

  // One round-trip per interaction: the facets (`scheduleExecutionFilters`)
  // ride the list operation — see the query docstring for the facet semantics.
  const retryKey = useRetryKey();
  const queryData = useLazyLoadQuery<ScheduleExecutionsQueryType>(
    scheduleExecutionsRelayQuery,
    { scheduleId, filter: backendFilters, search: querySearch || null, sort, first: EXECUTIONS_PAGE_SIZE, after: null },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
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
    // `scriptName` rides beside the shared row fragment on this list only — a
    // schedule runs several scripts, so the rows say which one they were.
    const rows = edges.flatMap(edge => (edge?.node ? [toUiExecution(edge.node, edge.node.scriptName)] : []));
    // A no-op here — this list's search reaches the server, so `narrowSearch` is
    // always empty. Kept so every caller of the shell honours the same contract.
    return narrowExecutions(rows, narrowSearch);
  }, [data.scheduleExecutions?.edges, narrowSearch]);

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
 * Execution History for a schedule — the flat per-device history across all of
 * its runs (`scheduleExecutions(scheduleId:)`). Same rows, columns and filters
 * as the per-script tab; the Runs tab is the aggregate view above it.
 *
 * The boundary lives inside `ExecutionsTabShell`, BELOW the toolbar, so a filter
 * change reloads the rows and leaves the search box where it was.
 *
 * `memo` for the reason given in `schedule-detail-tabs.ts`.
 */
export const ScheduleExecutionsTab = memo(function ScheduleExecutionsTab({ scheduleId }: ScheduleExecutionsTabProps) {
  return (
    <ExecutionsTabShell>
      {state => <ScheduleExecutionsContent scheduleId={scheduleId} state={state} />}
    </ExecutionsTabShell>
  );
});
