'use client';

import {
  ArrowRightUpIcon,
  Copy01Icon,
  Filter02Icon,
  SearchIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  ActionsMenuDropdown,
  type ActionsMenuGroup,
  Button,
  type ColumnDef,
  DataTable,
  FilterModal,
  Input,
  multiSelectFilterFn,
  type Row,
  SquareAvatar,
  Tag,
  TruncateText,
  useDataTable,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useApiParams, useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useRouter } from 'next/navigation';
import { Suspense, useCallback, useMemo, useState } from 'react';
import { useLazyLoadQuery, usePaginationFragment } from 'react-relay';
import type { scheduleRunsRelay_query$key as RunsFragmentKey } from '@/__generated__/scheduleRunsRelay_query.graphql';
import type { scheduleRunsRelayPaginationQuery as RunsPaginationQueryType } from '@/__generated__/scheduleRunsRelayPaginationQuery.graphql';
import type {
  scheduleRunsRelayQuery as RunsQueryType,
  ScheduleRunFilterInput,
} from '@/__generated__/scheduleRunsRelayQuery.graphql';
import { employeeDetailHref } from '@/app/(app)/settings/employees/routes';
import { useDeferredQuery } from '@/app/hooks/use-deferred-query';
import { useSearchParam } from '@/app/hooks/use-search-param';
import { useStickyToolbar } from '@/app/hooks/use-sticky-toolbar';
import { ScriptExecutionStatus } from '@/generated/schema-enums';
import { scheduleRunsRelayFragment, scheduleRunsRelayQuery } from '@/graphql/scripts/schedule-runs-relay';
import { getFullImageUrl } from '@/lib/image-url';
import { openInNewTab } from '@/lib/open-in-new-tab';
import { decodeGlobalId } from '@/lib/relay-id';
import { routes } from '@/lib/routes';
import {
  executionStatusLabel,
  executionStatusVariant,
  formatExecutionTimestamp,
  initiatorInitials,
  initiatorName,
} from '../utils/execution-helpers';

const PAGE_SIZE = 20;

/**
 * Fallback status options: the `ScriptExecutionStatus` enum itself, used until
 * `scheduleRunFilters` answers. The server facet is the real source — it lists
 * only the states this schedule's runs actually reached — but it arrives with
 * the rows, and a funnel that is empty on first paint reads as "no filters
 * available" rather than "not loaded yet".
 */
const RUN_STATUS_OPTIONS = Object.values(ScriptExecutionStatus).map(value => ({
  id: value,
  label: executionStatusLabel(value),
  value,
}));

interface UiRun {
  id: string;
  executionId: string;
  status: string;
  timestamp: string;
  responded: number;
  total: number;
  initiatorId: string;
  initiatorName: string;
  initiatorInitials: string;
  initiatorImage?: string;
  /** Scheduled fires carry no initiator — a person only fires a run manually. */
  isScheduled: boolean;
}

interface ScheduleRunsTabProps {
  scheduleId: string;
}

// ----------------------------------------------------------------
// Inner content — Relay hooks, must live inside Suspense
// ----------------------------------------------------------------

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
}: ContentProps) {
  const router = useRouter();
  const { toast } = useToast();

  const queryData = useLazyLoadQuery<RunsQueryType>(
    scheduleRunsRelayQuery,
    { scheduleId, filter: backendFilters, search: debouncedSearch || null, first: PAGE_SIZE, after: null },
    { fetchPolicy: 'store-and-network' },
  );

  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<RunsPaginationQueryType, RunsFragmentKey>(
    scheduleRunsRelayFragment,
    queryData,
  );

  // Server facet, scoped to the same filter/search the rows came back with —
  // so the dropdown offers the states these runs actually reached instead of
  // every state the enum can name. Falls back to the enum until it answers.
  const statusFacet = queryData.scheduleRunFilters?.statuses;
  const statusOptions = useMemo(
    () =>
      statusFacet && statusFacet.length > 0
        ? statusFacet.map(s => ({ id: s.value, label: executionStatusLabel(s.value), value: s.value }))
        : RUN_STATUS_OPTIONS,
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
          isScheduled: !node.initiator,
        },
      ];
    });
  }, [data.scheduleRuns?.edges]);

  const fetchNextPage = useCallback(() => {
    if (hasNext && !isLoadingNext) loadNext(PAGE_SIZE);
  }, [hasNext, isLoadingNext, loadNext]);

  // Drill-down: the run's executions are the ones stamped with its executionId,
  // which the Execution History tab's search matches.
  // The run's own page (design 310:33508). Before it existed this pointed at the
  // schedule's Execution History tab with the run's executionId seeded into its
  // search — same rows, but under the schedule's identity and unlinkable.
  const runDetailsHref = useCallback((run: UiRun) => routes.scriptsV2.schedules.run(run.id), []);

  const renderRowActions = useCallback(
    (run: UiRun) => {
      const groups: ActionsMenuGroup[] = [
        {
          items: [
            {
              id: 'copy-execution-id',
              label: 'Copy Execution ID',
              icon: <Copy01Icon className="w-6 h-6 text-ods-text-secondary" />,
              onClick: () => {
                navigator.clipboard
                  ?.writeText(run.executionId)
                  .then(() => toast({ title: 'Copied', description: 'Execution ID copied', variant: 'success' }))
                  .catch(() => toast({ title: 'Error', description: 'Failed to copy', variant: 'destructive' }));
              },
            },
          ],
        },
      ];
      return <ActionsMenuDropdown groups={groups} />;
    },
    [toast],
  );

  const columns = useMemo<ColumnDef<UiRun>[]>(
    () => [
      {
        accessorKey: 'executionId',
        header: 'Execution',
        // Stretch column: the execution id is a full uuid and this is the one
        // place it is shown in full (it is what the Execution History drill-down
        // and "Copy Execution ID" key on).
        cell: ({ row }: { row: Row<UiRun> }) => (
          <div className="flex flex-col justify-center gap-[var(--spacing-system-xxs)] min-w-0">
            <TruncateText>{row.original.timestamp}</TruncateText>
            <TruncateText variant="h6" tone="secondary">
              {row.original.executionId}
            </TruncateText>
          </div>
        ),
        enableSorting: false,
        meta: { width: 'flex-1 min-w-0' },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }: { row: Row<UiRun> }) => (
          <div className="flex">
            <Tag
              label={executionStatusLabel(row.original.status)}
              variant={executionStatusVariant(row.original.status)}
            />
          </div>
        ),
        enableSorting: false,
        filterFn: multiSelectFilterFn,
        meta: { width: 'w-[120px]', filter: { options: statusOptions } },
      },
      {
        accessorKey: 'responded',
        header: 'Devices',
        // "80/150" = devices we have processed at least one result from, over
        // the devices the fire targeted. The denominator is greyed so the eye
        // lands on the number that moves; no slack around the slash, it reads as
        // one value rather than two.
        cell: ({ row }: { row: Row<UiRun> }) => (
          <span className="text-h4 text-ods-text-primary whitespace-nowrap">
            {row.original.responded}
            <span className="text-ods-text-secondary">/{row.original.total}</span>
          </span>
        ),
        enableSorting: false,
        meta: { width: 'w-[120px]', hideAt: 'lg' },
      },
      {
        // accessorKey is `initiatorId` so a future server facet can reuse it;
        // the cell renders the name (or "Scheduled" for an automatic fire).
        accessorKey: 'initiatorId',
        header: 'Executed by',
        cell: ({ row }: { row: Row<UiRun> }) => {
          if (row.original.isScheduled) {
            return (
              <TruncateText tone="secondary" className="flex-1">
                Scheduled
              </TruncateText>
            );
          }

          // The initiator id is a User global id; decode it to the raw id the
          // REST-backed employee page expects. `data-no-row-click` stops the
          // row's own navigation so only the user page opens.
          const rawInitiatorId = decodeGlobalId(row.original.initiatorId)?.rawId ?? row.original.initiatorId;
          const href = rawInitiatorId ? employeeDetailHref(rawInitiatorId) : null;

          const avatar = (
            <SquareAvatar
              variant="round"
              size="md"
              src={row.original.initiatorImage}
              fallback={row.original.initiatorInitials}
              alt={row.original.initiatorName}
              initialsClassName="text-ods-text-secondary"
            />
          );

          if (!href) {
            return (
              <div className="flex flex-1 items-center gap-[var(--spacing-system-xsf)] min-w-0">
                {avatar}
                <div className="min-w-0 flex-1">
                  <TruncateText>{row.original.initiatorName}</TruncateText>
                </div>
              </div>
            );
          }

          return (
            <div data-no-row-click className="flex min-w-0 flex-1 pointer-events-auto">
              <button
                type="button"
                onClick={openInNewTab(href)}
                className="flex w-full items-center gap-[var(--spacing-system-xsf)] min-w-0 text-left"
              >
                {avatar}
                <div className="min-w-0 flex-1">
                  <TruncateText className="text-ods-accent underline">{row.original.initiatorName}</TruncateText>
                </div>
              </button>
            </div>
          );
        },
        enableSorting: false,
        meta: { width: 'flex-1 min-w-0', hideAt: 'md', cellClassName: 'self-stretch' },
      },
      {
        id: 'actions',
        cell: ({ row }: { row: Row<UiRun> }) => (
          <div
            data-no-row-click
            className="flex gap-[var(--spacing-system-xsf)] items-center justify-end pointer-events-auto"
          >
            {renderRowActions(row.original)}
          </div>
        ),
        enableSorting: false,
        meta: { width: 'w-12 shrink-0 flex-none', align: 'right' },
      },
      {
        id: 'open',
        cell: ({ row }: { row: Row<UiRun> }) => (
          <div data-no-row-click className="flex items-center justify-end pointer-events-auto">
            <Button
              onClick={() => router.push(runDetailsHref(row.original))}
              variant="outline"
              size="icon"
              leftIcon={<ArrowRightUpIcon className="w-5 h-5" />}
              aria-label="Open run details"
              className="bg-ods-card"
            />
          </div>
        ),
        enableSorting: false,
        meta: { width: 'w-12 shrink-0 flex-none', hideAt: 'md', align: 'right' },
      },
    ],
    [renderRowActions, router, runDetailsHref, statusOptions],
  );

  // The SAME options the desktop column funnel gets — the server facet, not the
  // whole enum. Built from `statusOptions` so the mobile modal cannot offer a
  // status these runs never reached while the desktop dropdown hides it.
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

  const emptyMessage = debouncedSearch
    ? `No runs found matching "${debouncedSearch}". Try adjusting your search.`
    : hasActiveFilter
      ? 'No runs match the current filters. Try adjusting them.'
      : 'No runs yet. Every time this schedule fires, the dispatch shows up here.';

  return (
    <>
      {/* Dim (don't unmount) the stale rows while a deferred refetch is in flight. */}
      <div className={`transition-opacity duration-200 ${isPending ? 'opacity-60' : ''}`}>
        <DataTable table={table}>
          {showHeader && (
            <DataTable.Header stickyHeader stickyHeaderOffset={stickyHeaderOffset} rightSlot={<DataTable.RowCount />} />
          )}
          <DataTable.Body
            skeletonRows={PAGE_SIZE}
            emptyMessage={emptyMessage}
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

// ----------------------------------------------------------------
// Skeleton
// ----------------------------------------------------------------

const EMPTY_ROWS: UiRun[] = [];

function ScheduleRunsSkeleton({ stickyHeaderOffset }: { stickyHeaderOffset?: string } = {}) {
  const columns = useMemo<ColumnDef<UiRun>[]>(
    () => [
      { accessorKey: 'executionId', header: 'Execution', enableSorting: false, meta: { width: 'flex-1 min-w-0' } },
      { accessorKey: 'status', header: 'Status', enableSorting: false, meta: { width: 'w-[120px]' } },
      { accessorKey: 'responded', header: 'Devices', enableSorting: false, meta: { width: 'w-[120px]', hideAt: 'lg' } },
      {
        accessorKey: 'initiatorName',
        header: 'Executed by',
        enableSorting: false,
        meta: { width: 'flex-1 min-w-0', hideAt: 'md' },
      },
      // The loaded table ends in two 48px action columns. They carry no header
      // text, but they do carry width — leaving them out of the skeleton meant
      // the `flex-1` columns were laid out across ~128px more than they would
      // get, and every label jumped left the moment the rows arrived.
      { id: 'actions', enableSorting: false, meta: { width: 'w-12 shrink-0 flex-none', align: 'right' } },
      {
        id: 'open',
        enableSorting: false,
        meta: { width: 'w-12 shrink-0 flex-none', hideAt: 'md', align: 'right' },
      },
    ],
    [],
  );

  const table = useDataTable<UiRun>({
    data: EMPTY_ROWS,
    columns,
    getRowId: (row: UiRun) => row.id,
    enableSorting: false,
  });

  return (
    <DataTable table={table}>
      <DataTable.Header stickyHeader stickyHeaderOffset={stickyHeaderOffset} />
      <DataTable.Body loading={true} skeletonRows={PAGE_SIZE} emptyMessage="" rowClassName="mb-1" />
    </DataTable>
  );
}

// ----------------------------------------------------------------
// Outer shell — URL filter state + Suspense boundary
// ----------------------------------------------------------------

/**
 * Schedule Runs — one row per *fire* of the schedule, the aggregate above the
 * flat Execution History (a run fans out to one execution per script × device).
 * A row opens the Execution History tab narrowed to that run's executionId.
 */
export function ScheduleRunsTab({ scheduleId }: ScheduleRunsTabProps) {
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
    // The negative `-mt-lf` cancels the `gap-lf` the details view puts between
    // the tab bar and this content (TabNavigation renders as a fragment, so the
    // tab bar and this body are sibling flex items).
    <div className="flex flex-col -mt-[var(--spacing-system-lf)]" style={containerStyle}>
      <div
        ref={toolbarRef}
        className="sticky top-0 z-20 flex items-center gap-[var(--spacing-system-xs)] bg-ods-bg pt-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
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
          leftIcon={<Filter02Icon />}
        />
      </div>
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
        />
      </Suspense>
    </div>
  );
}
