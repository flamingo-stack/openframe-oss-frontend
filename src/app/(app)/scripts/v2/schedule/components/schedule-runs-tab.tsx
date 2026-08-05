'use client';

import {
  ClockHistoryIcon,
  Filter02Icon,
  SearchIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Button,
  DataTable,
  FilterModal,
  Input,
  useDataTable,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useApiParams } from '@flamingo-stack/openframe-frontend-core/hooks';
import { memo, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useLazyLoadQuery, usePaginationFragment } from 'react-relay';
import type { scheduleRunsRelay_query$key as RunsFragmentKey } from '@/__generated__/scheduleRunsRelay_query.graphql';
import type { scheduleRunsRelayPaginationQuery as RunsPaginationQueryType } from '@/__generated__/scheduleRunsRelayPaginationQuery.graphql';
import type {
  scheduleRunsRelayQuery as RunsQueryType,
  ScheduleRunFilterInput,
} from '@/__generated__/scheduleRunsRelayQuery.graphql';
import { isDeletedUserStatus } from '@/app/components/shared/deleted-user';
import { useDeferredQuery } from '@/app/hooks/use-deferred-query';
import { useSearchParam } from '@/app/hooks/use-search-param';
import { useStickyToolbar } from '@/app/hooks/use-sticky-toolbar';
import { ScriptExecutionStatus } from '@/generated/schema-enums';
import { scheduleRunsRelayFragment, scheduleRunsRelayQuery } from '@/graphql/scripts/schedule-runs-relay';
import { getFullImageUrl } from '@/lib/image-url';
import {
  executionStatusLabel,
  formatExecutionTimestamp,
  initiatorInitials,
  initiatorName,
} from '../../shared/utils/execution-helpers';
import {
  RUNS_PAGE_SIZE,
  runDetailsHref,
  ScheduleRunsSkeleton,
  type UiRun,
  useScheduleRunColumns,
} from './schedule-runs-columns';

/**
 * Fallback status options: the `ScriptExecutionStatus` enum itself, used until
 * `scheduleRunFilters` answers. The server facet is the real source — it lists
 * only the states this schedule's runs actually reached — but it arrives with
 * the rows, and a funnel that is empty on first paint reads as "no filters
 * available" rather than "not loaded yet".
 */
const FALLBACK_STATUS_OPTIONS = Object.values(ScriptExecutionStatus).map(value => ({
  id: value,
  label: executionStatusLabel(value),
  value,
}));

interface ContentProps {
  scheduleId: string;
  backendFilters: ScheduleRunFilterInput;
  debouncedSearch: string;
  tableFilters: Record<string, string[]>;
  /** True while a deferred refetch is in flight and the rows on screen are stale. */
  isPending: boolean;
  onFilterChange: (filters: Record<string, string[]>) => void;
  mobileFilterOpen: boolean;
  onMobileFilterClose: () => void;
  stickyHeaderOffset: string;
  /** Reports the "no runs yet" placeholder up, so the tab can drop the toolbar over it. */
  onEmptyChange: (empty: boolean) => void;
}

function ScheduleRunsContent({
  scheduleId,
  backendFilters,
  debouncedSearch,
  tableFilters,
  isPending,
  onFilterChange,
  mobileFilterOpen,
  onMobileFilterClose,
  stickyHeaderOffset,
  onEmptyChange,
}: ContentProps) {
  const queryData = useLazyLoadQuery<RunsQueryType>(
    scheduleRunsRelayQuery,
    { scheduleId, filter: backendFilters, search: debouncedSearch || null, first: RUNS_PAGE_SIZE, after: null },
    { fetchPolicy: 'store-and-network' },
  );

  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<RunsPaginationQueryType, RunsFragmentKey>(
    scheduleRunsRelayFragment,
    queryData,
  );

  // Server facet, scoped to the same filter/search the rows came back with — so
  // the dropdown offers the states these runs actually reached instead of every
  // state the enum can name. Falls back to the enum until it answers.
  const statusFacet = queryData.scheduleRunFilters?.statuses;
  const statusOptions = useMemo(
    () =>
      statusFacet && statusFacet.length > 0
        ? statusFacet.map(s => ({ id: s.value, label: executionStatusLabel(s.value), value: s.value }))
        : FALLBACK_STATUS_OPTIONS,
    [statusFacet],
  );

  const runs: UiRun[] = useMemo(() => {
    const edges = data.scheduleRuns?.edges ?? [];
    // Defensive null-node guard: skip any dangling edge instead of crashing the
    // tab on a store-evicted record.
    return edges.flatMap(edge => {
      const node = edge?.node;
      if (!node) return [];
      return [
        {
          id: node.id,
          executionId: node.executionId,
          status: node.status,
          timestamp: formatExecutionTimestamp(node.dispatchedAt),
          responded: node.respondedMachineCount,
          total: node.totalMachineCount,
          initiatorId: node.initiator?.id ?? '',
          initiatorName: initiatorName(node.initiator),
          initiatorInitials: initiatorInitials(node.initiator),
          initiatorImage: getFullImageUrl(node.initiator?.image?.imageUrl, node.initiator?.image?.hash),
          initiatorDeleted: isDeletedUserStatus(node.initiator?.status),
          isScheduled: !node.initiator,
        },
      ];
    });
  }, [data.scheduleRuns?.edges]);

  const fetchNextPage = useCallback(() => {
    if (hasNext && !isLoadingNext) loadNext(RUNS_PAGE_SIZE);
  }, [hasNext, isLoadingNext, loadNext]);

  const columns = useScheduleRunColumns(statusOptions);

  // The SAME options the desktop column funnel gets — the server facet, not the
  // whole enum, so the mobile modal cannot offer a status these runs never
  // reached while the desktop dropdown hides it.
  const filterGroups = useMemo(() => [{ id: 'status', title: 'Status', options: statusOptions }], [statusOptions]);

  const columnFilters = useMemo(
    () =>
      Object.entries(tableFilters)
        .filter(([, value]) => value && value.length > 0)
        .map(([id, value]) => ({ id, value })),
    [tableFilters],
  );

  const handleColumnFiltersChange = useCallback(
    (updater: unknown) => {
      const next = typeof updater === 'function' ? updater(columnFilters) : updater;
      const nextFilters: Record<string, string[]> = {};
      for (const f of next as Array<{ id: string; value: string[] | string }>) {
        nextFilters[f.id] = Array.isArray(f.value) ? f.value : [f.value];
      }
      onFilterChange(nextFilters);
    },
    [columnFilters, onFilterChange],
  );

  const table = useDataTable<UiRun>({
    data: runs,
    columns,
    getRowId: (row: UiRun) => row.id,
    enableSorting: false,
    state: { columnFilters },
    onColumnFiltersChange: handleColumnFiltersChange,
  });

  const hasActiveFilter = columnFilters.length > 0;
  const showHeader = runs.length > 0 || hasActiveFilter || isPending;

  // Narrowed vs genuinely empty. Only the second is a design state (566:25741);
  // the first is the table's own "no results" placeholder, named for these rows.
  const narrowed = !!debouncedSearch || hasActiveFilter;
  const emptyState = narrowed
    ? {
        icon: <SearchIcon />,
        title: 'No runs found',
        description: debouncedSearch
          ? `Nothing matches "${debouncedSearch}". Try adjusting your search or filters.`
          : 'Try adjusting your filters.',
      }
    : {
        icon: <ClockHistoryIcon />,
        title: 'No runs yet',
        description: 'Past schedule runs will appear here',
      };

  // Only the un-narrowed empty list hides the toolbar: when narrowing is what
  // emptied it, the search box is the way back out.
  const isEmptyState = runs.length === 0 && !narrowed && !isPending;
  useEffect(() => {
    onEmptyChange(isEmptyState);
  }, [isEmptyState, onEmptyChange]);
  // Restore it on the way out: this content unmounts whenever its query
  // re-suspends, and a toolbar hidden by rows that are gone would never return.
  useEffect(() => () => onEmptyChange(false), [onEmptyChange]);

  return (
    <>
      {/* Dim (don't unmount) the stale rows while a deferred refetch is in flight. */}
      <div className={`transition-opacity duration-200 ${isPending ? 'opacity-60' : ''}`}>
        <DataTable table={table}>
          {showHeader && (
            <DataTable.Header stickyHeader stickyHeaderOffset={stickyHeaderOffset} rightSlot={<DataTable.RowCount />} />
          )}
          <DataTable.Body
            skeletonRows={RUNS_PAGE_SIZE}
            emptyState={emptyState}
            rowClassName="mb-1"
            rowHref={runDetailsHref}
          />
          {runs.length > 0 && (
            <DataTable.InfiniteFooter
              hasNextPage={hasNext}
              isFetchingNextPage={isLoadingNext}
              onLoadMore={fetchNextPage}
              skeletonRows={2}
            />
          )}
        </DataTable>
      </div>

      <FilterModal
        isOpen={mobileFilterOpen}
        onClose={onMobileFilterClose}
        filterGroups={filterGroups}
        onFilterChange={onFilterChange}
        currentFilters={tableFilters}
      />
    </>
  );
}

/**
 * Schedule Runs — one row per *fire* of the schedule, the aggregate above the
 * flat Execution History (a run fans out to one execution per script × device).
 * A row opens the run's own page.
 *
 * The boundary sits BELOW this tab's own toolbar, so a filter change reloads the
 * rows and leaves the search box where it was.
 *
 * `memo` for the reason given in `schedule-detail-tabs.ts`.
 */
export const ScheduleRunsTab = memo(function ScheduleRunsTab({ scheduleId }: { scheduleId: string }) {
  const { toolbarRef, containerStyle, stickyHeaderOffset } = useStickyToolbar();
  // Deliberately NOT `search` / `status`: those belong to the Execution History
  // tab on this same page (and its `search` is what a Runs row drills into), so
  // sharing the keys would leak this table's narrowing into that one on a tab
  // switch.
  const { params, setParam, setParams } = useApiParams({
    runSearch: { type: 'string', default: '' },
    runStatus: { type: 'array', default: [] },
  });
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  // Set by the content below (the only thing that knows how many rows there are):
  // an un-narrowed empty list has nothing to search, so the toolbar goes away and
  // leaves the placeholder alone.
  const [isEmpty, setIsEmpty] = useState(false);

  const {
    search: searchInput,
    setSearch: setSearchInput,
    debouncedSearch,
  } = useSearchParam(params.runSearch, value => setParam('runSearch', value), 300);

  const backendFilters: ScheduleRunFilterInput = useMemo(
    () => ({
      ...(params.runStatus.length > 0 && { statuses: params.runStatus as ScheduleRunFilterInput['statuses'] }),
    }),
    [params.runStatus],
  );

  const { deferredFilters, deferredSearch, isPending } = useDeferredQuery(backendFilters, debouncedSearch);

  const tableFilters = useMemo(() => ({ status: params.runStatus }), [params.runStatus]);

  const handleFilterChange = useCallback(
    (columnFilters: Record<string, string[]>) => {
      setParams({ runStatus: columnFilters.status || [] });
      document.querySelector('main')?.scrollTo({ top: 0, behavior: 'instant' });
    },
    [setParams],
  );

  return (
    // No top offset to cancel: the details view groups the tab bar and its body
    // into one flex item, so the toolbar's own `pt-l` below IS the gap under the
    // bar.
    <div className="flex flex-col" style={containerStyle}>
      {!isEmpty && (
        <div
          ref={toolbarRef}
          className="sticky top-0 z-20 flex items-center gap-[var(--spacing-system-m)] bg-ods-bg pt-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
        >
          <div className="flex-1">
            <Input
              placeholder="Search for Runs"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              startAdornment={<SearchIcon className="w-4 h-4 md:w-6 md:h-6" />}
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileFilterOpen(true)}
            aria-label="Open filters"
            leftIcon={<Filter02Icon className="text-ods-text-primary" />}
          />
        </div>
      )}
      <Suspense fallback={<ScheduleRunsSkeleton stickyHeaderOffset={stickyHeaderOffset} />}>
        <ScheduleRunsContent
          scheduleId={scheduleId}
          debouncedSearch={deferredSearch}
          backendFilters={deferredFilters}
          isPending={isPending}
          tableFilters={tableFilters}
          onFilterChange={handleFilterChange}
          mobileFilterOpen={mobileFilterOpen}
          onMobileFilterClose={() => setMobileFilterOpen(false)}
          stickyHeaderOffset={stickyHeaderOffset}
          onEmptyChange={setIsEmpty}
        />
      </Suspense>
    </div>
  );
});
