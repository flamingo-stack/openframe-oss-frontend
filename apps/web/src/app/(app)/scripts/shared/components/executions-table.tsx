'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import {
  EXECUTION_COLUMNS,
  ExecutionDeviceCell,
  ExecutionDeviceGridCell,
  ExecutionInitiatorCell,
  ExecutionResultCell,
  ExecutionResultGridCell,
  ExecutionSourceBadge,
  ExecutionStatusCell,
  ExecutionStatusGridCell,
  ExecutionTimestampCell,
  ExecutionTimestampGridCell,
  getDeviceName,
  OpenInNewTabCell,
} from '@flamingo-stack/openframe-frontend-core/components/features';
import {
  ArrowRightUpIcon,
  Copy01Icon,
  Filter02Icon,
  SearchIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  ActionsMenuDropdown,
  type ActionsMenuGroup,
  type AutoRefreshControlProps,
  Button,
  type ColumnDef,
  type DataTableSettings,
  type DateFilterResult,
  type DateRange,
  FilterModal,
  Input,
  LoadingWhen,
  type NoDataProps,
  type Row,
  useDataTable,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import {
  CURSOR_PAGER_KEYS,
  type CursorPagerFooterProps,
  type CursorPagerVariables,
  useApiParams,
  useCursorPager,
  type UseCursorPagerReturn,
  useToast,
} from '@flamingo-stack/openframe-frontend-core/hooks';
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { readInlineData } from 'relay-runtime';
import type { executionFacets_filters$key as ExecutionFacetsKey } from '@/__generated__/executionFacets_filters.graphql';
import type { executionFields_execution$key as ExecutionFieldsKey } from '@/__generated__/executionFields_execution.graphql';
import type { ScriptExecutionFilterInput, SortInput } from '@/__generated__/scriptExecutionsRelayQuery.graphql';
import { ValueText } from '@/app/components/shared';
import { dateColumnHeader, type TableDateFilter } from '@/app/components/shared/date-column-header';
import { LiveTable } from '@/app/components/shared/live-table';
import { readCursor, StaleCursorBoundary } from '@/app/components/shared/stale-cursor-boundary';
import { useDeferredQuery } from '@/app/hooks/use-deferred-query';
import { useQueuedParamsWrite } from '@/app/hooks/use-queued-params-write';
import { useSearchParam } from '@/app/hooks/use-search-param';
import { useStickyToolbar } from '@/app/hooks/use-sticky-toolbar';
import { type TableLayout, tableLayoutFor, useTableGridGate } from '@/app/hooks/use-table-layout';
import { executionFacetsFragment } from '@/graphql/scripts/execution-facets';
import { executionFieldsFragment } from '@/graphql/scripts/execution-fields';
import { dateRangeFromParams, dateRangeToInstantBounds, toDayParam } from '@/lib/date-filter-params';
import { formatDateTime } from '@/lib/format-date';
import { openInNewTab } from '@/lib/open-in-new-tab';
import { PAGED_LISTS, type PagedListId } from '@/lib/paged-lists';
import { routes } from '@/lib/routes';
import { multiSelectFilterFn } from '@/lib/table-filters';
import { executionOutput, executionStatusLabel } from '../utils/execution-helpers';
import { type FacetOption, facetFilter, facetToSortedOptions } from '../utils/facet-options';
import { scriptsLiveColumnMeta, scriptsLiveColumnSize } from '../utils/grid-columns';
import { type Initiator, InitiatorAvatar, InitiatorName, toInitiator } from './initiator-identity';

/**
 * The Execution History table, shared by the per-SCRIPT tab
 * (`script-executions-tab.tsx`, `scriptExecutions(scriptId:)`) and the
 * per-SCHEDULE tab (`schedule-executions-tab.tsx`,
 * `scheduleExecutions(scheduleId:)`). Both read the same
 * `ScriptExecutionConnection` + `ScriptExecutionFilters` pair, so everything
 * except the Relay operation and its key argument lives here: the row shape,
 * the columns, the URL filter/search state and the sticky toolbar.
 *
 * Each list keeps only its own query wiring and feeds the result in through
 * {@link ExecutionsTable}. The two tabs page with First · Prev · Next, the
 * cursor in the URL under the tab's prefix (`paging` on the shell); the
 * Schedule Run Details page and the software action logs narrow on the client
 * (`clientSearch`) and stay on infinite scroll.
 */

export const EXECUTIONS_PAGE_SIZE = 20;

/**
 * Column layout — ONE declaration, the lib's (`EXECUTION_COLUMNS` in render
 * order as `EXECUTIONS_TABLE_COLUMNS`), read by {@link executionColumns} (the
 * loaded table and its loading state draw the same columns) and by the lib's own
 * picture of this table. Widths and `hideAt` were written out twice before, and the copies drifted.
 * See `table-column-layout.ts`.
 */

export type { ScriptExecutionFilterInput, SortInput };

/**
 * The one field these lists are ordered by — `ScriptExecution.dispatchedAt`, the
 * timestamp the Execution column already shows on its first line. Named once so
 * the calendar's direction and the query's `SortInput` cannot drift apart.
 */
const DISPATCHED_AT_SORT_FIELD = 'dispatchedAt';

export interface UiExecution {
  id: string;
  executionId: string;
  status: string;
  timestamp: string;
  machineId: string;
  machineName: string;
  organization: string;
  /** Who dispatched it: the "Executed by" cell draws this, and its `id` is the column's filter value. */
  initiator: Initiator;
  /**
   * Which script this execution ran — the second line under the initiator.
   * Empty unless the list passes it: the schedule lists do (a schedule runs
   * several scripts), the script tab doesn't (it would repeat its title).
   */
  scriptName: string;
  /** `ExecutionSource` — SCHEDULED / AI_ASSISTANT render a chip, MANUAL nothing. */
  source: string;
  result: string;
}

/**
 * Flattens one execution row — an `executionFields_execution` spread off any of
 * the three lists' edges — into what the table renders.
 *
 * `scriptName` is passed in rather than read: it is the only field the lists
 * disagree on (see the fragment's docstring), so the schedule lists hand over
 * the value they selected and the script tab omits it.
 */
export function toUiExecution(ref: ExecutionFieldsKey, scriptName?: string | null): UiExecution {
  const node = readInlineData(executionFieldsFragment, ref);
  return {
    id: node.id,
    executionId: node.executionId,
    status: node.status,
    timestamp: formatDateTime(node.dispatchedAt),
    machineId: node.machine?.machineId ?? '',
    machineName: getDeviceName(node.machine),
    organization: node.machine?.organization?.name ?? '',
    initiator: toInitiator(node.initiator),
    scriptName: scriptName ?? '',
    source: node.source,
    result: executionOutput({ stdout: node.stdout, stderr: node.stderr, error: node.error }),
  };
}

/**
 * Narrows already-loaded rows by a typed term — for a list whose server-side
 * `search` argument is already spoken for (see `clientSearch` on the shell).
 *
 * Matches the same things the server's search does plus what the row shows, so
 * the box behaves the way it does on the other execution lists. An empty term
 * returns the SAME array, so callers whose search does reach the server pay
 * nothing for calling this.
 */
export function narrowExecutions(executions: UiExecution[], term: string): UiExecution[] {
  const needle = term.trim().toLowerCase();
  if (!needle) return executions;

  return executions.filter(execution =>
    [
      execution.executionId,
      execution.machineName,
      execution.organization,
      execution.initiator.name,
      execution.scriptName,
      execution.result,
      executionStatusLabel(execution.status),
    ].some(field => field?.toLowerCase().includes(needle)),
  );
}

export interface ExecutionFacetOptions {
  statusOptions: FacetOption[];
  machineOptions: FacetOption[];
  initiatorOptions: FacetOption[];
}

/**
 * Server facets → dropdown options, from an `executionFacets_filters` spread off
 * either list's filters field. Status values are raw enums, mapped through the
 * shared label helper ("SUCCESS" → "Completed") and kept in the backend's
 * by-count order; the other two are label-sorted.
 */
export function useExecutionFacetOptions(ref: ExecutionFacetsKey | null | undefined): ExecutionFacetOptions {
  // Not a hook — an `@inline` read is a plain lookup in data the parent query
  // already fetched, so the conditional is fine and the useMemos below still run
  // unconditionally.
  const facets = ref ? readInlineData(executionFacetsFragment, ref) : null;
  const statuses = facets?.statuses;
  const initiators = facets?.initiators;
  const machines = facets?.machines;

  const statusOptions = useMemo(
    () =>
      (statuses ?? []).map(s => ({
        id: s.value,
        label: executionStatusLabel(s.value),
        value: s.value,
        count: s.count,
      })),
    [statuses],
  );
  const initiatorOptions = useMemo(() => facetToSortedOptions(initiators), [initiators]);
  const machineOptions = useMemo(() => facetToSortedOptions(machines), [machines]);

  return { statusOptions, initiatorOptions, machineOptions };
}

// ----------------------------------------------------------------
// Table
// ----------------------------------------------------------------

interface ExecutionsTableBaseProps {
  executions: UiExecution[];
  facetOptions: ExecutionFacetOptions;
  tableFilters: Record<string, string[]>;
  onFilterChange: (filters: Record<string, string[]>) => void;
  /**
   * True while the deferred query variables lag the live filter/search state (a
   * refetch is in flight and the rows on screen are the previous result) —
   * keeps the header mounted and dims the stale rows.
   */
  isPending: boolean;
  /** The server's total for the current narrowing (a paged list's header count and footer range). */
  totalCount?: number;
  /** The search term the rows on screen were fetched with (for the empty copy). */
  search: string;
  /** Dispatched-date sort + range, hosted by the Execution column's header. */
  dateFilter: TableDateFilter;
  /**
   * The empty state when nothing is searched or filtered — the design's
   * `data-placeholder` (icon / title / description), named for whatever list
   * this is. The narrowed case is the table's own "no results" placeholder and
   * is built here.
   */
  emptyState: NoDataProps;
  /** Pins the column header flush below the sticky search toolbar. */
  stickyHeaderOffset: string;
  mobileFilterOpen: boolean;
  onMobileFilterClose: () => void;
  /** See `ExecutionsTabState.onEmptyChange` — arrives with the shell's state. */
  onEmptyChange?: (empty: boolean) => void;
  /** The table's layout — arrives with the shell's state. Default: card rows. */
  tableLayout?: TableLayout;
  /** The grid table's settings (the viewer's saved column layout) — arrives with the shell's state. */
  tableSettings?: DataTableSettings;
}

/** How the table goes past its first page: a paged tab's footer, or the infinite scroll of a list narrowed on the client. */
type ExecutionsTablePaging =
  | {
      /** The First · Prev · Next footer (`usePagedTable`). */
      pager: CursorPagerFooterProps;
      /** The auto-refresh picker above the table (`usePagedTable`). */
      refresh: AutoRefreshControlProps;
      hasNext?: never;
      isLoadingNext?: never;
      onLoadMore?: never;
      loadedCount?: never;
    }
  | {
      pager?: never;
      refresh?: never;
      hasNext: boolean;
      isLoadingNext: boolean;
      onLoadMore: () => void;
      /**
       * Rows fetched so far, for a caller that narrows `executions` on the client
       * (see `narrowExecutions`). A page can then arrive in full and add no visible
       * row; without this the infinite footer reads that as a stalled fetch and
       * stops pulling the remaining pages in.
       */
      loadedCount?: number;
    };

export type ExecutionsTableProps = ExecutionsTableBaseProps & ExecutionsTablePaging;

/** A placeholder row's initiator (the table's loading form): nobody, so its avatar and name draw their loading form. */
const NO_INITIATOR = toInitiator(null);

/** Opens the execution's page in a new tab. Static chrome: drawn real while the row is read, and inert. */
function OpenExecutionButton({ executionId }: { executionId: string }) {
  const loading = useLoadingScope();
  return (
    <div data-no-row-click className="pointer-events-auto flex items-center justify-end">
      <Button
        onClick={loading ? undefined : openInNewTab(routes.scripts.execution(executionId))}
        variant="outline"
        size="icon"
        leftIcon={<ArrowRightUpIcon className="h-5 w-5" />}
        aria-label="Open execution details in new tab"
        className="bg-ods-card"
        disabled={loading}
      />
    </div>
  );
}

/** The device and its customer on one line (the grid layout); the empty mark where the execution names no device. */
function DeviceGridCell({ execution }: { execution: UiExecution }) {
  const loading = useLoadingScope();
  if (!loading && !execution.machineName) return <ValueText value={null} />;
  return <ExecutionDeviceGridCell name={execution.machineName} organization={execution.organization} />;
}

/**
 * "Executed by" on one line (the grid layout): the avatar, the name, the chip of what dispatched it and the script
 * beside them. The name stays the link to that person's page, as in the card rows; the script's name is the part
 * that gives way.
 */
function InitiatorGridCell({ execution }: { execution: UiExecution }) {
  // A placeholder row (the table's loading form) has no initiator.
  const initiator = execution.initiator ?? NO_INITIATOR;
  return (
    <div className="flex min-w-0 flex-1 items-center gap-[var(--spacing-system-xsf)]">
      <InitiatorAvatar initiator={initiator} size="sm" />
      <div className="flex min-w-0 flex-1 items-center gap-[var(--spacing-system-xxs)]">
        <InitiatorName initiator={initiator} inRow />
        <ExecutionSourceBadge source={execution.source} />
        {execution.scriptName && (
          <span className="min-w-0 flex-1 truncate text-ods-text-secondary text-h6">{execution.scriptName}</span>
        )}
      </div>
    </div>
  );
}

/**
 * The table's columns: the loaded table and its loading state draw the same ones. With no `facetOptions` (loading)
 * the filterable columns' funnels are pending and the Execution header's calendar is inert. Each column also states
 * what the grid layout reads: its width, its name in the settings menu and its one-line cell.
 */
function executionColumns({
  facetOptions,
  dateFilter,
  renderRowActions,
  layout,
}: {
  facetOptions: ExecutionFacetOptions | null;
  dateFilter: TableDateFilter | null;
  renderRowActions: (execution: UiExecution) => ReactNode;
  /** The table's layout: which of the two date headers the Execution column gets. Default: card rows. */
  layout?: TableLayout;
}): ColumnDef<UiExecution>[] {
  // The cell's first line IS the dispatched timestamp, so the calendar (date range + newest/oldest first) belongs on
  // this header rather than on a column of its own.
  const date = dateColumnHeader(EXECUTION_COLUMNS.executionId.header, dateFilter ?? undefined, layout);
  return [
    {
      accessorKey: 'executionId',
      header: date.header,
      cell: ({ row }: { row: Row<UiExecution> }) => (
        <ExecutionTimestampCell timestamp={row.original.timestamp} executionId={row.original.executionId} />
      ),
      enableSorting: false,
      ...scriptsLiveColumnSize(EXECUTION_COLUMNS.executionId),
      meta: scriptsLiveColumnMeta(EXECUTION_COLUMNS.executionId, {
        dateFilter: date.dateFilter,
        gridCell: ({ row }: { row: Row<UiExecution> }) => (
          <ExecutionTimestampGridCell timestamp={row.original.timestamp} executionId={row.original.executionId} />
        ),
      }),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }: { row: Row<UiExecution> }) => <ExecutionStatusCell status={row.original.status} />,
      enableSorting: false,
      filterFn: multiSelectFilterFn,
      ...scriptsLiveColumnSize(EXECUTION_COLUMNS.status),
      meta: scriptsLiveColumnMeta(EXECUTION_COLUMNS.status, {
        filter: facetFilter(facetOptions?.statusOptions),
        gridCell: ({ row }: { row: Row<UiExecution> }) => <ExecutionStatusGridCell status={row.original.status} />,
      }),
    },
    {
      // accessorKey is `machineId` so the filter option values (machineIds)
      // match the `machineIds` server filter; the cell still renders the name.
      accessorKey: 'machineId',
      header: 'Device',
      cell: ({ row }: { row: Row<UiExecution> }) => (
        <ExecutionDeviceCell
          name={<ValueText value={row.original.machineName} />}
          organization={row.original.organization}
        />
      ),
      enableSorting: false,
      filterFn: multiSelectFilterFn,
      ...scriptsLiveColumnSize(EXECUTION_COLUMNS.machineId),
      meta: scriptsLiveColumnMeta(EXECUTION_COLUMNS.machineId, {
        filter: facetFilter(facetOptions?.machineOptions),
        gridCell: ({ row }: { row: Row<UiExecution> }) => <DeviceGridCell execution={row.original} />,
      }),
    },
    {
      // The column's value is the initiator's id so the filter option values (user ids)
      // match the `initiatorIds` server filter; the cell still renders the name.
      id: 'initiatorId',
      // A placeholder row (the table's loading form) has no initiator.
      accessorFn: (execution: UiExecution) => execution.initiator?.id,
      header: 'Executed by',
      // The avatar + name open that user's page in a new tab; only the NAME opts out of the row link (the rest of the
      // cell still navigates to the execution, like every other cell).
      cell: ({ row }: { row: Row<UiExecution> }) => {
        const initiator = row.original.initiator ?? NO_INITIATOR;
        return (
          <ExecutionInitiatorCell
            avatar={<InitiatorAvatar initiator={initiator} size="md" />}
            name={<InitiatorName initiator={initiator} inRow />}
            source={row.original.source}
            scriptName={row.original.scriptName}
          />
        );
      },
      enableSorting: false,
      filterFn: multiSelectFilterFn,
      ...scriptsLiveColumnSize(EXECUTION_COLUMNS.initiatorId),
      meta: scriptsLiveColumnMeta(EXECUTION_COLUMNS.initiatorId, {
        filter: facetFilter(facetOptions?.initiatorOptions),
        gridCell: ({ row }: { row: Row<UiExecution> }) => <InitiatorGridCell execution={row.original} />,
      }),
    },
    {
      accessorKey: 'result',
      header: 'Result',
      cell: ({ row }: { row: Row<UiExecution> }) => (
        <ExecutionResultCell result={row.original.result} empty={<ValueText value={null} />} />
      ),
      enableSorting: false,
      ...scriptsLiveColumnSize(EXECUTION_COLUMNS.result),
      meta: scriptsLiveColumnMeta(EXECUTION_COLUMNS.result, {
        gridCell: ({ row }: { row: Row<UiExecution> }) => (
          <ExecutionResultGridCell result={row.original.result} empty={<ValueText value={null} />} />
        ),
      }),
    },
    {
      id: 'actions',
      cell: ({ row }: { row: Row<UiExecution> }) => (
        <div data-no-row-click className="pointer-events-auto flex items-center justify-end gap-2">
          {renderRowActions(row.original)}
        </div>
      ),
      enableSorting: false,
      ...scriptsLiveColumnSize(EXECUTION_COLUMNS.actions),
      meta: scriptsLiveColumnMeta(EXECUTION_COLUMNS.actions),
    },
    {
      id: 'open',
      cell: ({ row }: { row: Row<UiExecution> }) => <OpenExecutionButton executionId={row.original.id} />,
      enableSorting: false,
      ...scriptsLiveColumnSize(EXECUTION_COLUMNS.open),
      meta: scriptsLiveColumnMeta(EXECUTION_COLUMNS.open, {
        gridCell: ({ row }: { row: Row<UiExecution> }) => (
          <OpenInNewTabCell
            href={routes.scripts.execution(row.original.id)}
            grid
            label="Open execution details in new tab"
          />
        ),
      }),
    },
  ];
}

export function ExecutionsTable({
  executions,
  facetOptions,
  tableFilters,
  onFilterChange,
  isPending,
  totalCount,
  pager,
  refresh,
  hasNext = false,
  isLoadingNext = false,
  onLoadMore,
  loadedCount,
  search,
  dateFilter,
  emptyState,
  stickyHeaderOffset,
  mobileFilterOpen,
  onMobileFilterClose,
  onEmptyChange,
  tableLayout,
  tableSettings,
}: ExecutionsTableProps) {
  const { toast } = useToast();
  const { statusOptions, machineOptions, initiatorOptions } = facetOptions;

  const executionHref = useCallback((execution: UiExecution) => routes.scripts.execution(execution.id), []);

  const renderRowActions = useCallback(
    (execution: UiExecution) => {
      const groups: ActionsMenuGroup[] = [
        {
          items: [
            {
              id: 'copy-execution-id',
              label: 'Copy Execution ID',
              icon: <Copy01Icon className="h-6 w-6 text-ods-text-secondary" />,
              onClick: () => {
                navigator.clipboard
                  ?.writeText(execution.executionId)
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

  const columns = useMemo(
    () =>
      executionColumns({
        facetOptions: { statusOptions, machineOptions, initiatorOptions },
        dateFilter,
        renderRowActions,
        layout: tableLayout,
      }),
    [statusOptions, machineOptions, initiatorOptions, dateFilter, renderRowActions, tableLayout],
  );

  const filterGroups = useMemo(
    () => [
      { id: 'status', title: 'Status', options: statusOptions },
      { id: 'machineId', title: 'Device', options: machineOptions },
      { id: 'initiatorId', title: 'Executed by', options: initiatorOptions },
    ],
    [statusOptions, machineOptions, initiatorOptions],
  );

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

  const table = useDataTable<UiExecution>({
    data: executions,
    columns,
    getRowId: (row: UiExecution) => row.id,
    enableSorting: false,
    state: { columnFilters },
    onColumnFiltersChange: handleColumnFiltersChange,
  });

  // Hide the column header on an empty list (cleaner empty state), but keep it
  // when a filter is active (so the dropdowns stay reachable to clear it) and
  // while a deferred refetch is pending (the rows on screen are stale — don't
  // tear the header down on them).
  // The date range narrows the list exactly like a funnel does, so it counts as
  // an active filter everywhere below — the header stays reachable, and an empty
  // result reads as "nothing matched" instead of "this script never ran". The
  // sort direction deliberately does NOT count: it reorders, it never excludes.
  const hasActiveFilter = columnFilters.length > 0 || Boolean(dateFilter.range);
  // An empty LATER page (a cursor about to be dropped) keeps the table and its footer, so First stays reachable.
  const laterPage = pager ? !pager.isFirstPage : false;
  const showHeader = executions.length > 0 || hasActiveFilter || isPending || laterPage;

  // `emptyState` claims nothing ever ran — only true without an active
  // search/filter; otherwise it's the narrowing that produced the empty result,
  // and the table's own "no results" placeholder is what says so.
  //
  // `hasNext` (infinite scroll only) wins over both: an empty list with pages
  // still to come is a list being narrowed CLIENT-side (the server can't have
  // returned zero rows and a next page), and "nothing matched" would be a claim
  // we can't make yet — the footer below is still pulling the pages that might.
  const resolvedEmptyState: NoDataProps = hasNext
    ? { icon: <SearchIcon />, title: 'Looking through the remaining executions…' }
    : search || hasActiveFilter
      ? {
          icon: <SearchIcon />,
          title: 'No executions found',
          description: search
            ? `Nothing matches "${search}". Try adjusting your search or filters.`
            : 'Try adjusting your filters.',
        }
      : emptyState;

  // Only the un-narrowed empty list hides the toolbar: when narrowing is what
  // emptied it, the search box is the way back out.
  const isEmptyState = executions.length === 0 && !search && !hasActiveFilter && !hasNext && !isPending && !laterPage;
  useEffect(() => {
    onEmptyChange?.(isEmptyState);
  }, [isEmptyState, onEmptyChange]);
  // Restore it on the way out: this table unmounts whenever its query re-suspends,
  // and a toolbar hidden by a list that is no longer rendered would never return.
  useEffect(() => () => onEmptyChange?.(false), [onEmptyChange]);

  return (
    <>
      <LiveTable
        isPending={isPending}
        table={table}
        pageSize={EXECUTIONS_PAGE_SIZE}
        totalCount={totalCount}
        stickyHeaderOffset={stickyHeaderOffset}
        // The list is one section of a script's, a schedule's or a run's page: the page scrolls, so the grid table
        // takes no height of its own.
        layout={tableLayout}
        settings={tableSettings}
        showHeader={showHeader}
        emptyState={resolvedEmptyState}
        rowHref={executionHref}
        pager={pager}
        refresh={refresh}
        // Infinite scroll only. Kept mounted on an EMPTY list too, as long as more pages exist — that only happens
        // under client-side narrowing, and there the sentinel is what walks the rest of the pages so the term ends up
        // searching the whole list instead of just the first page.
        footer={
          onLoadMore && (executions.length > 0 || hasNext)
            ? { hasNextPage: hasNext, isFetchingNextPage: isLoadingNext, onLoadMore, loadedCount }
            : null
        }
      />

      <FilterModal
        isOpen={mobileFilterOpen}
        onClose={onMobileFilterClose}
        filterGroups={filterGroups}
        onFilterChange={onFilterChange}
        currentFilters={tableFilters}
        // The header calendar is a desktop control; on mobile the same sort +
        // range lives in this modal, drafted alongside the funnels.
        dateFilter={{
          title: 'Execution Date',
          sort: dateFilter.sortDirection,
          range: dateFilter.range,
          onChange: dateFilter.onApply,
        }}
      />
    </>
  );
}

// ----------------------------------------------------------------
// Loading state
// ----------------------------------------------------------------

/** The columns before the first answer: funnels pending, the calendar inert, no row to act on. */
const LOADING_COLUMNS = executionColumns({ facetOptions: null, dateFilter: null, renderRowActions: () => null });

// ----------------------------------------------------------------
// Outer shell — URL filter state + Suspense boundary
// ----------------------------------------------------------------

/** Everything the shell owns, handed to the tab's Relay content. */
export interface ExecutionsTabState {
  backendFilters: ScriptExecutionFilterInput;
  /**
   * The `sort` argument for the query — always `dispatchedAt`, in the direction
   * the calendar holds. Deferred in lockstep with `backendFilters`, so a
   * direction flip keeps the current rows on screen while the refetch runs.
   */
  sort: SortInput;
  /** The `search` argument for the query. Empty under `clientSearch`, where the caller supplies its own scope. */
  querySearch: string;
  /**
   * What the user typed when it CAN'T reach the server (`clientSearch`) — run it
   * through {@link narrowExecutions} before handing the rows to
   * {@link ExecutionsTable}. Empty on every list whose search is server-side,
   * where narrowing is then a no-op.
   */
  narrowSearch: string;
  isPending: boolean;
  tableFilters: Record<string, string[]>;
  onFilterChange: (filters: Record<string, string[]>) => void;
  /** Spread straight into {@link ExecutionsTable} — the header hosts the popover. */
  dateFilter: TableDateFilter;
  mobileFilterOpen: boolean;
  onMobileFilterClose: () => void;
  stickyHeaderOffset: string;
  /**
   * Reports whether the list is showing its "nothing here at all" placeholder,
   * so the shell can drop the search toolbar over it. Spread straight into
   * {@link ExecutionsTable}, which is what knows.
   */
  onEmptyChange: (empty: boolean) => void;
  /**
   * The table's layout, from the app's one table flag. The shell reads the flag ONCE and hands the layout to the
   * loading table and, through this state, to {@link ExecutionsTable}: the two never draw different tables.
   */
  tableLayout: TableLayout;
  /** The grid table's settings: the list's own storage key. Spread into {@link ExecutionsTable} with the layout. */
  tableSettings?: DataTableSettings;
}

/**
 * A paged tab's state: the shell's, plus its position in the URL. No `narrowSearch`: a paged list's search always
 * reaches the server (narrowing one page on the client would hide rows the footer counts).
 */
export interface PagedExecutionsTabState extends Omit<ExecutionsTabState, 'narrowSearch'> {
  /** The list's position in the URL: footer props, the stale check, the cursor drop. */
  pager: UseCursorPagerReturn;
  /** Deferred — the page variables to spread into the query (lag the URL while the next page is read). */
  pageVariables: CursorPagerVariables;
  /** The URL prefix of the tab's params (its auto-refresh interval sits beside them). */
  paramPrefix: string;
}

/** A paged tab: where its params live in the URL and what its API can do for the pager. */
export interface ExecutionsPaging {
  /**
   * The tab's URL prefix (`execSearch`, `execStatus`, …, `execCursor`): a details page's tabs share its URL, so the
   * list keeps its params under a name of its own.
   */
  prefix: string;
  /** What the list's API can do for the pager (`PAGED_LISTS`). */
  list: Extract<PagedListId, 'scriptExecutions' | 'scheduleExecutions'>;
}

/** The part of the shell's state that is the same with or without paging, and is not deferred. */
type ExecutionsTabControls = Omit<
  ExecutionsTabState,
  'backendFilters' | 'sort' | 'querySearch' | 'narrowSearch' | 'isPending'
>;

/** The query variables the shell keeps live (reference-stable per value: `useDeferredQuery` compares identities). */
interface ExecutionsQueryVars {
  filter: ScriptExecutionFilterInput;
  sort: SortInput;
}

interface ExecutionsTabBodyProps<
  S extends Pick<ExecutionsTabState, 'stickyHeaderOffset' | 'tableLayout' | 'tableSettings'>,
> {
  state: S;
  children: (state: S) => ReactNode;
}

/**
 * The tab's rows under its toolbar, with their own boundary: in its scope the reader draws the table's loading form.
 * The whole output of its own component (the loading standard); a paged tab draws it under its stale-cursor boundary.
 */
function ExecutionsTabBody<S extends Pick<ExecutionsTabState, 'stickyHeaderOffset' | 'tableLayout' | 'tableSettings'>>(
  props: ExecutionsTabBodyProps<S>,
) {
  return (
    <LoadingSuspense label="Loading executions">
      <ExecutionsTabBodyReader {...props} />
    </LoadingSuspense>
  );
}

function ExecutionsTabBodyReader<
  S extends Pick<ExecutionsTabState, 'stickyHeaderOffset' | 'tableLayout' | 'tableSettings'>,
>({ state, children }: ExecutionsTabBodyProps<S>) {
  // In a loading scope (its boundary's fallback, or an outer loading state) it draws itself with no data and runs no read.
  if (useLoadingScope()) {
    return (
      <LiveTable
        columns={LOADING_COLUMNS}
        pageSize={EXECUTIONS_PAGE_SIZE}
        stickyHeaderOffset={state.stickyHeaderOffset}
        layout={state.tableLayout}
        settings={state.tableSettings}
      />
    );
  }
  return children(state);
}

interface ExecutionsTabRowsProps {
  queryVars: ExecutionsQueryVars;
  /** The search the query reads (live; deferred here). */
  search: string;
  controls: ExecutionsTabControls;
}

/** The rows of a list with no pager (infinite scroll): the query variables deferred, the boundary below. */
function ExecutionsTabRows({
  queryVars,
  search,
  controls,
  clientSearch,
  children,
}: ExecutionsTabRowsProps & { clientSearch: boolean; children: (state: ExecutionsTabState) => ReactNode }) {
  // Deferred query variables: on a filter/search interaction the table keeps
  // rendering the current rows while the refetch is in flight, instead of
  // dropping to the Suspense skeleton. The dropdown state (`tableFilters`) stays
  // live so the checkboxes respond instantly.
  const { deferredFilters: deferredVars, deferredSearch, isPending } = useDeferredQuery(queryVars, search);
  return (
    <ExecutionsTabBody
      state={{
        ...controls,
        backendFilters: deferredVars.filter,
        sort: deferredVars.sort,
        // A caller whose `search` is spoken for gets the typed term as
        // client-side narrowing instead. Everywhere else it is the query's own
        // term and nothing is narrowed twice.
        querySearch: clientSearch ? '' : deferredSearch,
        narrowSearch: clientSearch ? deferredSearch : '',
        isPending,
      }}
    >
      {children}
    </ExecutionsTabBody>
  );
}

/**
 * The rows of a paged tab: the pager beside the shell's URL params (same prefix; `resetOn` is their content), the
 * query variables and the page deferred together, the stale-cursor boundary around the rows' own boundary.
 */
function PagedExecutionsTabRows({
  queryVars,
  search,
  controls,
  paging,
  resetOn,
  children,
}: ExecutionsTabRowsProps & {
  paging: ExecutionsPaging;
  /** Content key of the shell's params: a cursor issued under other filters is not sent, and is dropped. */
  resetOn: string;
  children: (state: PagedExecutionsTabState) => ReactNode;
}) {
  const pager = useCursorPager({
    prefix: paging.prefix,
    pageSize: EXECUTIONS_PAGE_SIZE,
    ...PAGED_LISTS[paging.list],
    resetOn,
  });
  // Deferred, page included: a filter, search or page move keeps the current rows on screen (dimmed) while the next
  // ones are read, instead of dropping to the Suspense skeleton.
  const {
    deferredFilters: deferredVars,
    deferredSearch,
    deferredPage,
    isPending,
  } = useDeferredQuery(queryVars, search, pager.variables);
  const state: PagedExecutionsTabState = {
    ...controls,
    backendFilters: deferredVars.filter,
    sort: deferredVars.sort,
    querySearch: deferredSearch,
    isPending,
    pager,
    pageVariables: deferredPage,
    paramPrefix: paging.prefix,
  };
  return (
    <StaleCursorBoundary cursor={readCursor(deferredPage)} onStaleCursor={pager.dropCursor}>
      <ExecutionsTabBody state={state}>{children}</ExecutionsTabBody>
    </StaleCursorBoundary>
  );
}

type ExecutionsTabShellProps = {
  /** The search box's placeholder — the lists name their rows differently. */
  searchPlaceholder?: string;
  /**
   * The grid table's settings: the storage key the viewer's column layout is kept under. Each list names its own
   * (`SCRIPTS_TABLE_SETTINGS`); lists that draw the same columns share one.
   *
   * Naming it is how a list takes part in the app's table flag: with it the list draws the grid table where the flag
   * is on. A list that names none stays on card rows whatever the flag says.
   */
  tableSettings?: DataTableSettings;
} & (
  | {
      /**
       * The two Execution History tabs: one page at a time with First · Prev · Next, the params and the cursor in the
       * URL under the tab's prefix. A change to the search, a funnel or the calendar drops the cursor in the same URL
       * write (one history entry on page 2+, so Back returns to the old view).
       */
      paging: ExecutionsPaging;
      clientSearch?: never;
      children: (state: PagedExecutionsTabState) => ReactNode;
    }
  | {
      paging?: never;
      /**
       * Says the query's `search` argument is already spoken for, so the typed term
       * comes back as `narrowSearch` instead of `querySearch`.
       *
       * The Schedule Run Details page: it shows the executions of ONE fire, and the
       * only handle the API offers for that is `search` on the run's `executionId`
       * (`ScriptExecutionFilterInput` has no execution-id field, and `ScheduleRun`
       * has no executions connection of its own). Sending the user's term would
       * replace that scope and silently widen the page to the whole schedule.
       *
       * A flag rather than the scope VALUE on purpose: the value is server data on
       * that page, and demanding it here would keep the toolbar — which needs no
       * data at all — waiting behind the same query as the rows. The column funnels
       * are unaffected either way; they travel in `filter`, so they compose with
       * whatever scope the caller applies.
       */
      clientSearch?: boolean;
      children: (state: ExecutionsTabState) => ReactNode;
    }
);

/**
 * URL-backed filter/search state + the sticky search toolbar + the Suspense
 * boundary around the Relay content. Every executions list renders this — the
 * per-script tab and the per-schedule tab (`paging`), the Schedule Run Details
 * page and the software action logs (`clientSearch`) — and supplies only the
 * query wiring through `children`.
 */
export function ExecutionsTabShell(props: ExecutionsTabShellProps) {
  const { searchPlaceholder = 'Search for Executions', tableSettings } = props;
  const prefix = props.paging?.prefix;
  const { toolbarRef, containerStyle, stickyHeaderOffset } = useStickyToolbar();
  // A paged tab keeps these under its prefix (`execSearch`, …), and a change to any of them drops the pager's cursor
  // in the SAME URL write. The lists with no pager keep the plain names.
  const { params, setParam, setParams } = useApiParams(
    {
      search: { type: 'string', default: '' },
      status: { type: 'array', default: [] },
      machineId: { type: 'array', default: [] },
      initiatorId: { type: 'array', default: [] },
      // Dispatched-date range (local `yyyy-MM-dd`, inclusive) + its sort direction
      // — the Execution column's calendar. `desc` (newest first) is the backend's
      // own default order and stays out of the URL.
      dateFrom: { type: 'string', default: '' },
      dateTo: { type: 'string', default: '' },
      sortDir: { type: 'string', default: 'desc' },
    },
    prefix === undefined ? {} : { prefix, resetKeys: CURSOR_PAGER_KEYS, resetHistory: 'push' },
  );
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  // The new grid table, behind the app's one table flag; card rows while it is off, and for a list that has not
  // named its storage key (it has not moved to the grid).
  const tableGate = useTableGridGate();
  const followsTableFlag = tableSettings !== undefined;
  const tableLayout = followsTableFlag ? tableLayoutFor(tableGate) : 'cards';
  // Set by the table below (the only thing that knows how many rows there are):
  // an un-narrowed empty list has nothing to search, so the toolbar goes away and
  // leaves the placeholder alone.
  const [isEmpty, setIsEmpty] = useState(false);

  // Local search input keeps typing responsive; debounced into the URL param.
  const {
    search: searchInput,
    setSearch: setSearchInput,
    debouncedSearch,
  } = useSearchParam(params.search, value => setParam('search', value), 300);

  // Applied dispatched-date range, restored from the URL.
  const dateRange: DateRange | undefined = useMemo(
    () => dateRangeFromParams(params.dateFrom, params.dateTo),
    [params.dateFrom, params.dateTo],
  );
  const sortDirection: 'asc' | 'desc' = params.sortDir === 'asc' ? 'asc' : 'desc';

  // Filter + sort travel together as one deferred object so the query lags in
  // lockstep and `isPending` covers both — the same shape the schedules table
  // uses. The picked days become inclusive UTC instants (`00:00` → `23:59:59`
  // local), so a day picked in the calendar is the whole day on the server.
  const queryVars: ExecutionsQueryVars = useMemo(() => {
    const bounds = dateRangeToInstantBounds(dateRange);
    const filter: ScriptExecutionFilterInput = {
      ...(params.status.length > 0 && { statuses: params.status as ScriptExecutionFilterInput['statuses'] }),
      ...(params.machineId.length > 0 && { machineIds: params.machineId }),
      ...(params.initiatorId.length > 0 && { initiatorIds: params.initiatorId }),
      ...(bounds.from && { dispatchedAtFrom: bounds.from }),
      ...(bounds.to && { dispatchedAtTo: bounds.to }),
    };
    // Always sent, both directions: the header indicator claims an order, and
    // leaving `desc` implicit would rest that claim on an undocumented backend
    // default instead of on what we asked for.
    const sort: SortInput = {
      field: DISPATCHED_AT_SORT_FIELD,
      direction: sortDirection === 'asc' ? 'ASC' : 'DESC',
    };
    return { filter, sort };
  }, [params.status, params.machineId, params.initiatorId, dateRange, sortDirection]);

  const tableFilters = useMemo(
    () => ({ status: params.status, machineId: params.machineId, initiatorId: params.initiatorId }),
    [params.status, params.machineId, params.initiatorId],
  );

  // The mobile FilterModal commits the funnels and the date section as two
  // callbacks in the same tick; the shared writer merges them into a single URL
  // write (sequential setParams calls each re-read the stale URL and clobber, so
  // the funnel selection would be lost whenever a date is applied beside it).
  const queueParamsWrite = useQueuedParamsWrite(setParams);

  const handleFilterChange = useCallback(
    (columnFilters: Record<string, string[]>) => {
      queueParamsWrite({
        status: columnFilters.status || [],
        machineId: columnFilters.machineId || [],
        initiatorId: columnFilters.initiatorId || [],
      });
    },
    [queueParamsWrite],
  );

  // Apply (and Reset, which fires with the cleared selection). `sortDir: ''` —
  // NOT `'desc'` — for the default direction: `useApiParams` drops a param only
  // when the value is empty, so writing `'desc'` would leave `?sortDir=desc`
  // behind on a list in its default order. Reading it back still yields `desc`.
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

  const controls: ExecutionsTabControls = {
    tableFilters,
    onFilterChange: handleFilterChange,
    dateFilter,
    mobileFilterOpen,
    onMobileFilterClose: () => setMobileFilterOpen(false),
    stickyHeaderOffset,
    onEmptyChange: setIsEmpty,
    tableLayout,
    tableSettings,
  };

  return (
    // No top offset to cancel: every caller renders this flush against what
    // sits above it, so the toolbar's own `pt-l` below IS the separating gap.
    <div className="flex flex-col" style={containerStyle}>
      {/* Search stays pinned to the top of the scroll area; its measured height
          feeds the sticky column header offset. `pt-l` sits above the input (and,
          once the `-mt-6` cancels the parent gap, is the sole top spacing), `pb-l`
          separates it from the table below — the `bg-ods-bg` hides rows scrolling
          underneath while the toolbar is pinned. */}
      {!isEmpty && (
        <div
          ref={toolbarRef}
          className="sticky top-0 z-20 flex items-center gap-[var(--spacing-system-m)] bg-ods-bg pb-[var(--spacing-system-l)] pt-[var(--spacing-system-l)]"
        >
          <div className="flex-1">
            <Input
              userValue
              placeholder={searchPlaceholder}
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
      <LoadingWhen loading={followsTableFlag && tableGate === 'loading'}>
        {props.paging ? (
          <PagedExecutionsTabRows
            queryVars={queryVars}
            // The URL's search, not the box's debounced value: the URL write that carries a new search drops the cursor
            // in the same navigation, so the two can never meet in one request (the box runs one commit ahead).
            search={params.search}
            controls={controls}
            paging={props.paging}
            resetOn={JSON.stringify(params)}
          >
            {props.children}
          </PagedExecutionsTabRows>
        ) : (
          <ExecutionsTabRows
            queryVars={queryVars}
            search={debouncedSearch}
            controls={controls}
            clientSearch={props.clientSearch ?? false}
          >
            {props.children}
          </ExecutionsTabRows>
        )}
      </LoadingWhen>
    </div>
  );
}
