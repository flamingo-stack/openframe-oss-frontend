'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import {
  ClockHistoryIcon,
  Filter02Icon,
  SearchIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Button,
  type DateFilterResult,
  type DateRange,
  FilterModal,
  Input,
  LoadingWhen,
  useDataTable,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import {
  CURSOR_PAGER_KEYS,
  type CursorPagerVariables,
  useApiParams,
  useCursorPager,
  type UseCursorPagerReturn,
} from '@flamingo-stack/openframe-frontend-core/hooks';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useLazyLoadQuery } from 'react-relay';
import type {
  scheduleRunsRelayQuery as RunsQueryType,
  ScheduleRunFilterInput,
  SortInput,
} from '@/__generated__/scheduleRunsRelayQuery.graphql';
import { useRetryKey } from '@/app/components/shared';
import type { TableDateFilter } from '@/app/components/shared/date-column-header';
import { LiveTable } from '@/app/components/shared/live-table';
import { readCursor, StaleCursorBoundary } from '@/app/components/shared/stale-cursor-boundary';
import { useDeferredQuery } from '@/app/hooks/use-deferred-query';
import { usePagedTable } from '@/app/hooks/use-paged-table';
import { useQueuedParamsWrite } from '@/app/hooks/use-queued-params-write';
import { useRefetchPage } from '@/app/hooks/use-refetch-page';
import { useSearchParam } from '@/app/hooks/use-search-param';
import { useStickyToolbar } from '@/app/hooks/use-sticky-toolbar';
import { type TableLayout, tableLayoutFor, useTableGridGate } from '@/app/hooks/use-table-layout';
import { ScriptExecutionStatus } from '@/generated/schema-enums';
import { scheduleRunsRelayQuery } from '@/graphql/scripts/schedule-runs-relay';
import { dateRangeFromParams, dateRangeToInstantBounds, toDayParam } from '@/lib/date-filter-params';
import { formatDateTime } from '@/lib/format-date';
import { PAGED_LISTS } from '@/lib/paged-lists';
import { toInitiator } from '../../shared/components/initiator-identity';
import { executionStatusLabel } from '../../shared/utils/execution-helpers';
import { SCRIPTS_TABLE_SETTINGS } from '../../shared/utils/grid-columns';
import {
  RUNS_PAGE_SIZE,
  runDetailsHref,
  SCHEDULE_RUN_LOADING_COLUMNS,
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

/**
 * The one field the runs list is ordered by — `ScheduleRun.dispatchedAt`, the
 * timestamp the Execution column shows on its first line.
 */
const DISPATCHED_AT_SORT_FIELD = 'dispatchedAt';

/**
 * The tab's params live under this prefix (`runSearch`, `runStatus`, `runDateFrom`, `runDateTo`, `runSortDir`,
 * `runCursor`, `runPage`, `runDir`): the Execution History tab on the same page keeps its own under `exec…`, and a
 * shared key would carry one table's narrowing into the other on a tab switch.
 */
const PARAM_PREFIX = 'run';

interface ContentProps {
  scheduleId: string;
  backendFilters: ScheduleRunFilterInput;
  /** Dispatched-date order behind the Execution header's calendar. */
  sort: SortInput;
  debouncedSearch: string;
  tableFilters: Record<string, string[]>;
  /** Dispatched-date sort + range, hosted by the Execution column's header. */
  dateFilter: TableDateFilter;
  /** True while a deferred refetch is in flight and the rows on screen are stale. */
  isPending: boolean;
  onFilterChange: (filters: Record<string, string[]>) => void;
  mobileFilterOpen: boolean;
  onMobileFilterClose: () => void;
  stickyHeaderOffset: string;
  /** Reports the "no runs yet" placeholder up, so the tab can drop the toolbar over it. */
  onEmptyChange: (empty: boolean) => void;
  /** The list's position in the URL: footer props, the stale check, the cursor drop. */
  pager: UseCursorPagerReturn;
  /** Deferred — the page variables to spread into the query (lag the URL while the next page is read). */
  pageVariables: CursorPagerVariables;
  /** The URL prefix of the tab's params (its auto-refresh interval sits beside them). */
  paramPrefix: string;
  /** The table's layout, from the app's one table flag: read once by the tab and handed to every form of the list. */
  tableLayout: TableLayout;
}

/**
 * The table's layout props, the same for the loaded table and its loading form. The tab is one section of the
 * schedule's page, so the page scrolls and the grid table takes no height of its own; `LiveTable` passes the
 * settings on only in the grid layout.
 */
function gridTableProps(tableLayout: TableLayout) {
  return { layout: tableLayout, settings: SCRIPTS_TABLE_SETTINGS.scheduleRuns };
}

function ScheduleRunsContent({
  scheduleId,
  backendFilters,
  sort,
  debouncedSearch,
  tableFilters,
  dateFilter,
  isPending,
  onFilterChange,
  mobileFilterOpen,
  onMobileFilterClose,
  stickyHeaderOffset,
  onEmptyChange,
  pager,
  pageVariables,
  paramPrefix,
  tableLayout,
}: ContentProps) {
  // One page per request, its cursor in the URL (`runCursor`); the list pages back on the server.
  const retryKey = useRetryKey();
  const variables = {
    scheduleId,
    filter: backendFilters,
    search: debouncedSearch || null,
    sort,
    ...pageVariables,
  };
  const queryData = useLazyLoadQuery<RunsQueryType>(scheduleRunsRelayQuery, variables, {
    fetchPolicy: 'store-and-network',
    fetchKey: retryKey,
  });
  const refetch = useRefetchPage<RunsQueryType>(scheduleRunsRelayQuery, variables);

  const paged = usePagedTable({
    pager,
    pageInfo: queryData.scheduleRuns?.pageInfo,
    rowCount: queryData.scheduleRuns?.edges?.length ?? 0,
    prefix: paramPrefix,
    refetch,
    isPending,
  });

  // Server facet, scoped to the same filter/search the rows came back with — so
  // the dropdown offers the states these runs actually reached instead of every
  // state the enum can name. Falls back to the enum until it answers.
  const statusFacet = queryData.scheduleRunFilters?.statuses;
  const statusOptions = useMemo(
    () =>
      statusFacet && statusFacet.length > 0
        ? statusFacet.map(s => ({ id: s.value, label: executionStatusLabel(s.value), value: s.value, count: s.count }))
        : FALLBACK_STATUS_OPTIONS,
    [statusFacet],
  );

  const runs: UiRun[] = useMemo(() => {
    const edges = queryData.scheduleRuns?.edges ?? [];
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
          timestamp: formatDateTime(node.dispatchedAt),
          responded: node.respondedMachineCount,
          total: node.totalMachineCount,
          initiator: toInitiator(node.initiator),
          isScheduled: !node.initiator,
        },
      ];
    });
  }, [queryData.scheduleRuns?.edges]);

  const columns = useScheduleRunColumns(statusOptions, dateFilter, tableLayout);

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

  // The date range narrows like a funnel does, so it counts as an active filter:
  // the header stays reachable to clear it, and an empty result reads as
  // "nothing matched" rather than "this schedule never fired". The sort
  // direction does NOT count — it reorders, it never excludes.
  const hasActiveFilter = columnFilters.length > 0 || Boolean(dateFilter.range);
  // An empty LATER page (a cursor about to be dropped) keeps the table and its footer, so First stays reachable.
  const laterPage = !pager.isFirstPage;
  const showHeader = runs.length > 0 || hasActiveFilter || isPending || laterPage;

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
  const isEmptyState = runs.length === 0 && !narrowed && !isPending && !laterPage;
  useEffect(() => {
    onEmptyChange(isEmptyState);
  }, [isEmptyState, onEmptyChange]);
  // Restore it on the way out: this content unmounts whenever its query
  // re-suspends, and a toolbar hidden by rows that are gone would never return.
  useEffect(() => () => onEmptyChange(false), [onEmptyChange]);

  return (
    <>
      <LiveTable
        isPending={isPending}
        table={table}
        pageSize={RUNS_PAGE_SIZE}
        totalCount={queryData.scheduleRuns?.filteredCount ?? undefined}
        stickyHeaderOffset={stickyHeaderOffset}
        {...gridTableProps(tableLayout)}
        showHeader={showHeader}
        emptyState={emptyState}
        rowHref={runDetailsHref}
        pager={paged.pager}
        refresh={paged.refresh}
      />

      <FilterModal
        isOpen={mobileFilterOpen}
        onClose={onMobileFilterClose}
        filterGroups={filterGroups}
        onFilterChange={onFilterChange}
        currentFilters={tableFilters}
        // The header calendar is a desktop control; on mobile the same sort +
        // range lives in this modal, drafted alongside the status funnel.
        dateFilter={{
          title: 'Run Date',
          sort: dateFilter.sortDirection,
          range: dateFilter.range,
          onChange: dateFilter.onApply,
        }}
      />
    </>
  );
}

/**
 * The runs list, with its own boundary: in its scope the reader draws the table's loading form. A cursor the server
 * refuses drops to the first page (`StaleCursorBoundary`); any other error goes up unchanged.
 */
function ScheduleRunsTable(props: ContentProps) {
  return (
    <StaleCursorBoundary cursor={readCursor(props.pageVariables)} onStaleCursor={props.pager.dropCursor}>
      <ScheduleRunsTableLoading {...props} />
    </StaleCursorBoundary>
  );
}

/** The rows' loading boundary, the whole output of its own component (the loading standard), under the
 * stale-cursor boundary above. */
function ScheduleRunsTableLoading(props: ContentProps) {
  return (
    <LoadingSuspense label="Loading schedule runs">
      <ScheduleRunsTableReader {...props} />
    </LoadingSuspense>
  );
}

function ScheduleRunsTableReader(props: ContentProps) {
  // In a loading scope (its boundary's fallback, or an outer loading state) it draws itself with no data and runs no read.
  if (useLoadingScope())
    return (
      <LiveTable
        columns={SCHEDULE_RUN_LOADING_COLUMNS}
        pageSize={RUNS_PAGE_SIZE}
        stickyHeaderOffset={props.stickyHeaderOffset}
        {...gridTableProps(props.tableLayout)}
      />
    );
  return <ScheduleRunsContent {...props} />;
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
export const ScheduleRunsTab = memo(function ScheduleRunsTabImpl({ scheduleId }: { scheduleId: string }) {
  const { toolbarRef, containerStyle, stickyHeaderOffset } = useStickyToolbar();
  // The new grid table, behind the app's one table flag; card rows while it is off.
  const tableGate = useTableGridGate();
  // Under the `run` prefix (see `PARAM_PREFIX`). A change to the search, the funnel or the calendar drops the pager's
  // cursor in the SAME URL write (one history entry on page 2+, so Back returns to the old view).
  const { params, setParam, setParams } = useApiParams(
    {
      search: { type: 'string', default: '' },
      status: { type: 'array', default: [] },
      // `desc` (newest first) is the backend default and stays out of the URL.
      dateFrom: { type: 'string', default: '' },
      dateTo: { type: 'string', default: '' },
      sortDir: { type: 'string', default: 'desc' },
    },
    { prefix: PARAM_PREFIX, resetKeys: CURSOR_PAGER_KEYS, resetHistory: 'push' },
  );
  const pager = useCursorPager({
    prefix: PARAM_PREFIX,
    pageSize: RUNS_PAGE_SIZE,
    ...PAGED_LISTS.scheduleRuns,
    resetOn: JSON.stringify(params),
  });
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  // Set by the content below (the only thing that knows how many rows there are):
  // an un-narrowed empty list has nothing to search, so the toolbar goes away and
  // leaves the placeholder alone.
  const [isEmpty, setIsEmpty] = useState(false);

  // Local search input keeps typing responsive; the shared hook debounces it to the URL param.
  const { search: searchInput, setSearch: setSearchInput } = useSearchParam(
    params.search,
    value => setParam('search', value),
    300,
  );

  // Applied dispatched-date range, restored from the URL.
  const dateRange: DateRange | undefined = useMemo(
    () => dateRangeFromParams(params.dateFrom, params.dateTo),
    [params.dateFrom, params.dateTo],
  );
  const sortDirection: 'asc' | 'desc' = params.sortDir === 'asc' ? 'asc' : 'desc';

  // Filter + sort travel together as one deferred object so the query lags in
  // lockstep and `isPending` covers both. The picked days become inclusive UTC
  // instants, so a day picked in the calendar is that whole local day.
  const queryVars = useMemo(() => {
    const bounds = dateRangeToInstantBounds(dateRange);
    const filter: ScheduleRunFilterInput = {
      ...(params.status.length > 0 && { statuses: params.status as ScheduleRunFilterInput['statuses'] }),
      ...(bounds.from && { dispatchedAtFrom: bounds.from }),
      ...(bounds.to && { dispatchedAtTo: bounds.to }),
    };
    // Always sent, both directions — the header indicator claims an order, and
    // that claim should rest on what we asked for, not on a backend default.
    const sort: SortInput = {
      field: DISPATCHED_AT_SORT_FIELD,
      direction: sortDirection === 'asc' ? 'ASC' : 'DESC',
    };
    return { filter, sort };
  }, [params.status, dateRange, sortDirection]);

  // The query reads the search from the URL, not the box's debounced value: the URL write that carries a new search
  // drops the cursor in the same navigation, so the two can never meet in one request. The page is deferred with the
  // rest, so a page move keeps the current rows on screen (dimmed) while the next ones are read.
  const {
    deferredFilters: deferredVars,
    deferredSearch,
    deferredPage,
    isPending,
  } = useDeferredQuery(queryVars, params.search, pager.variables);

  const tableFilters = useMemo(() => ({ status: params.status }), [params.status]);

  // The mobile FilterModal commits the funnels and the date section as two
  // callbacks in the same tick; the shared writer merges them into a single URL
  // write (sequential setParams calls each re-read the stale URL and clobber, so
  // the status selection would be lost whenever a date is applied beside it).
  const queueParamsWrite = useQueuedParamsWrite(setParams);

  const handleFilterChange = useCallback(
    (columnFilters: Record<string, string[]>) => {
      queueParamsWrite({ status: columnFilters.status || [] });
    },
    [queueParamsWrite],
  );

  // Apply (and Reset, which fires with the cleared selection). `sortDir: ''`
  // — not `'desc'` — for the default direction: `useApiParams` drops a param
  // only when the value is empty, so writing the default would leave a stale
  // `?runSortDir=desc` on a list that is in its default order anyway.
  const handleDateFilterApply = useCallback(
    (result: DateFilterResult) => {
      queueParamsWrite({
        sortDir: result.sort === 'desc' ? '' : result.sort,
        dateFrom: result.range?.from ? toDayParam(result.range.from) : '',
        dateTo: result.range?.to ? toDayParam(result.range.to) : '',
      });
    },
    [queueParamsWrite],
  );

  const dateFilter: TableDateFilter = useMemo(
    () => ({ sortDirection, range: dateRange, onApply: handleDateFilterApply }),
    [sortDirection, dateRange, handleDateFilterApply],
  );

  return (
    // No top offset to cancel: the details view groups the tab bar and its body
    // into one flex item, so the toolbar's own `pt-l` below IS the gap under the
    // bar.
    <div className="flex flex-col" style={containerStyle}>
      {!isEmpty && (
        <div
          ref={toolbarRef}
          className="sticky top-0 z-20 flex items-center gap-[var(--spacing-system-m)] bg-ods-bg pb-[var(--spacing-system-l)] pt-[var(--spacing-system-l)]"
        >
          <div className="flex-1">
            <Input
              userValue
              placeholder="Search for Runs"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              startAdornment={<SearchIcon className="h-4 w-4 content-md:h-6 content-md:w-6" />}
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            className="content-md:hidden"
            onClick={() => setMobileFilterOpen(true)}
            aria-label="Open filters"
            leftIcon={<Filter02Icon className="text-ods-text-primary" />}
          />
        </div>
      )}
      {/* Until the flag answers the list is its loading form: a guess would draw one table and replace it. */}
      <LoadingWhen loading={tableGate === 'loading'}>
        <ScheduleRunsTable
          scheduleId={scheduleId}
          debouncedSearch={deferredSearch}
          backendFilters={deferredVars.filter}
          sort={deferredVars.sort}
          isPending={isPending}
          tableFilters={tableFilters}
          dateFilter={dateFilter}
          onFilterChange={handleFilterChange}
          mobileFilterOpen={mobileFilterOpen}
          onMobileFilterClose={() => setMobileFilterOpen(false)}
          stickyHeaderOffset={stickyHeaderOffset}
          onEmptyChange={setIsEmpty}
          pager={pager}
          pageVariables={deferredPage}
          paramPrefix={PARAM_PREFIX}
          tableLayout={tableLayoutFor(tableGate)}
        />
      </LoadingWhen>
    </div>
  );
});
ScheduleRunsTab.displayName = 'ScheduleRunsTab';
