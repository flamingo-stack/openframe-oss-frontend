'use client';

import {
  ArrowRightUpIcon,
  Copy01Icon,
  Filter02Icon,
  MonitorIcon,
  SearchIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  ActionsMenuDropdown,
  type ActionsMenuGroup,
  Button,
  type ColumnDef,
  DataTable,
  type DateFilterResult,
  type DateRange,
  FilterModal,
  Input,
  multiSelectFilterFn,
  type NoDataProps,
  type Row,
  SquareAvatar,
  Tag,
  TruncateText,
  useDataTable,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useApiParams, useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { useRouter } from 'next/navigation';
import { type ReactNode, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { readInlineData } from 'relay-runtime';
import type { executionFacets_filters$key as ExecutionFacetsKey } from '@/__generated__/executionFacets_filters.graphql';
import type { executionFields_execution$key as ExecutionFieldsKey } from '@/__generated__/executionFields_execution.graphql';
import type { ScriptExecutionFilterInput, SortInput } from '@/__generated__/scriptExecutionsRelayQuery.graphql';
import { employeeDetailHref } from '@/app/(app)/settings/employees/routes';
import { DateColumnHeader, type TableDateFilter } from '@/app/components/shared/date-column-header';
import { DeletedUserAvatar, isDeletedUserStatus } from '@/app/components/shared/deleted-user';
import {
  liveColumnMeta,
  skeletonColumnMeta,
  type TableSkeletonColumn,
} from '@/app/components/shared/table-column-layout';
import { useDeferredQuery } from '@/app/hooks/use-deferred-query';
import { useSearchParam } from '@/app/hooks/use-search-param';
import { useStickyToolbar } from '@/app/hooks/use-sticky-toolbar';
import { executionFacetsFragment } from '@/graphql/scripts/execution-facets';
import { executionFieldsFragment } from '@/graphql/scripts/execution-fields';
import { dateRangeFromParams, dateRangeToInstantBounds, toDayParam } from '@/lib/date-filter-params';
import { getFullImageUrl } from '@/lib/image-url';
import { openInNewTab } from '@/lib/open-in-new-tab';
import { decodeGlobalId } from '@/lib/relay-id';
import { routes } from '@/lib/routes';
import {
  executionResultText,
  executionStatusLabel,
  executionStatusVariant,
  formatExecutionTimestamp,
  initiatorInitials,
  initiatorName,
  machineLabel,
  organizationLabel,
} from '../utils/execution-helpers';
import { type FacetOption, facetToSortedOptions } from '../utils/facet-options';
import { ExecutionSourceBadge } from './execution-source-badge';

/**
 * The Execution History table, shared by the per-SCRIPT tab
 * (`script-executions-tab.tsx`, `scriptExecutions(scriptId:)`) and the
 * per-SCHEDULE tab (`schedule-executions-tab.tsx`,
 * `scheduleExecutions(scheduleId:)`). Both read the same
 * `ScriptExecutionConnection` + `ScriptExecutionFilters` pair, so everything
 * except the Relay operation and its key argument lives here: the row shape,
 * the columns, the URL filter/search state and the sticky toolbar.
 *
 * Each tab keeps only its own `useLazyLoadQuery` + `usePaginationFragment`
 * wiring and feeds the result in through {@link ExecutionsTable}.
 */

export const EXECUTIONS_PAGE_SIZE = 20;

/**
 * Column layout — ONE declaration, read by {@link ExecutionsTable} and by
 * {@link ExecutionsSkeleton}. Widths, `hideAt` and `filterable` were written out
 * twice before, and the copies drifted: the skeleton's three filterable columns
 * lost their `filterable`, so their funnels were missing while loading and
 * popped in with the facets, shifting every label. See `table-column-layout.ts`.
 */
const EXECUTION_COLUMNS = {
  executionId: { id: 'executionId', header: 'Execution', width: 'w-[160px]', dateFilterable: true },
  status: { id: 'status', header: 'Status', width: 'w-[120px]', filterable: true },
  machineId: { id: 'machineId', header: 'Device', width: 'w-[200px]', hideAt: 'lg', filterable: true },
  initiatorId: { id: 'initiatorId', header: 'Executed by', width: 'flex-1 min-w-0', hideAt: 'md', filterable: true },
  result: { id: 'result', header: 'Result', width: 'flex-1 min-w-0', hideAt: 'xl' },
  actions: { id: 'actions', width: 'w-12 shrink-0 flex-none', align: 'right' },
  open: { id: 'open', width: 'w-12 shrink-0 flex-none', hideAt: 'md', align: 'right' },
} satisfies Record<string, TableSkeletonColumn>;

/** Render order, shared by the live table and the skeleton. */
const EXECUTION_COLUMN_ORDER: readonly TableSkeletonColumn[] = [
  EXECUTION_COLUMNS.executionId,
  EXECUTION_COLUMNS.status,
  EXECUTION_COLUMNS.machineId,
  EXECUTION_COLUMNS.initiatorId,
  EXECUTION_COLUMNS.result,
  // The loaded table ends in two 48px action columns. They carry no header text,
  // but they do carry width — leaving them out of the skeleton laid the `flex-1`
  // columns across ~128px more than they get, and every label jumped left the
  // moment the rows arrived.
  EXECUTION_COLUMNS.actions,
  EXECUTION_COLUMNS.open,
];

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
  initiatorId: string;
  initiatorName: string;
  initiatorInitials: string;
  initiatorImage?: string;
  /** Initiator account is DELETED / SELF_DELETED — from `User.status` on the payload. */
  initiatorDeleted: boolean;
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
    timestamp: formatExecutionTimestamp(node.dispatchedAt as string | null),
    machineId: node.machine?.machineId ?? '',
    machineName: machineLabel(node.machine),
    organization: organizationLabel(node.machine),
    initiatorId: node.initiator?.id ?? '',
    initiatorName: initiatorName(node.initiator),
    initiatorInitials: initiatorInitials(node.initiator),
    initiatorImage: getFullImageUrl(node.initiator?.image?.imageUrl, node.initiator?.image?.hash),
    initiatorDeleted: isDeletedUserStatus(node.initiator?.status),
    scriptName: scriptName ?? '',
    source: node.source,
    result: executionResultText(node),
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
      execution.initiatorName,
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
    () => (statuses ?? []).map(s => ({ id: s.value, label: executionStatusLabel(s.value), value: s.value })),
    [statuses],
  );
  const initiatorOptions = useMemo(() => facetToSortedOptions(initiators), [initiators]);
  const machineOptions = useMemo(() => facetToSortedOptions(machines), [machines]);

  return { statusOptions, initiatorOptions, machineOptions };
}

// ----------------------------------------------------------------
// Table
// ----------------------------------------------------------------

export interface ExecutionsTableProps {
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
  hasNext: boolean;
  isLoadingNext: boolean;
  onLoadMore: () => void;
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
}

export function ExecutionsTable({
  executions,
  facetOptions,
  tableFilters,
  onFilterChange,
  isPending,
  hasNext,
  isLoadingNext,
  onLoadMore,
  search,
  dateFilter,
  emptyState,
  stickyHeaderOffset,
  mobileFilterOpen,
  onMobileFilterClose,
  onEmptyChange,
}: ExecutionsTableProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { statusOptions, machineOptions, initiatorOptions } = facetOptions;

  const executionHref = useCallback((execution: UiExecution) => routes.scriptsV2.execution(execution.id), []);

  const renderRowActions = useCallback(
    (execution: UiExecution) => {
      const groups: ActionsMenuGroup[] = [
        {
          items: [
            {
              id: 'copy-execution-id',
              label: 'Copy Execution ID',
              icon: <Copy01Icon className="w-6 h-6 text-ods-text-secondary" />,
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

  const columns = useMemo<ColumnDef<UiExecution>[]>(
    () => [
      {
        accessorKey: 'executionId',
        // The cell's first line IS the dispatched timestamp, so the calendar
        // (date range + newest/oldest first) belongs on this header rather than
        // on a column of its own.
        header: () => (
          <DateColumnHeader
            label={EXECUTION_COLUMNS.executionId.header}
            filter={dateFilter}
            ariaLabel="Sort and filter by execution date"
          />
        ),
        cell: ({ row }: { row: Row<UiExecution> }) => (
          <div className="flex flex-col justify-center gap-1 min-w-0">
            <TruncateText>{row.original.timestamp}</TruncateText>
            <TruncateText variant="h6" tone="secondary">
              {row.original.executionId}
            </TruncateText>
          </div>
        ),
        enableSorting: false,
        meta: liveColumnMeta(EXECUTION_COLUMNS.executionId),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        // Wrap in a flex row so the tag hugs its content instead of stretching to
        // the cell width (the cell is a stretch column).
        cell: ({ row }: { row: Row<UiExecution> }) => (
          <div className="flex">
            <Tag
              label={executionStatusLabel(row.original.status)}
              variant={executionStatusVariant(row.original.status)}
            />
          </div>
        ),
        enableSorting: false,
        filterFn: multiSelectFilterFn,
        meta: liveColumnMeta(EXECUTION_COLUMNS.status, { filter: { options: statusOptions } }),
      },
      {
        // accessorKey is `machineId` so the filter option values (machineIds)
        // match the `machineIds` server filter; the cell still renders the name.
        accessorKey: 'machineId',
        header: 'Device',
        // Icon rides only with the machine name on the first line; the org label
        // sits on its own line beneath, left-aligned to the icon (not indented
        // under the name) — matching the design.
        cell: ({ row }: { row: Row<UiExecution> }) => (
          <div className="flex flex-col justify-center gap-1 min-w-0">
            <div className="flex items-center gap-1 min-w-0">
              <MonitorIcon className="size-6 shrink-0 text-ods-text-secondary" />
              {/* min-w-0 flex-1 wrapper so the name can shrink and ellipsize next to the icon. */}
              <div className="min-w-0 flex-1">
                <TruncateText>{row.original.machineName}</TruncateText>
              </div>
            </div>
            {row.original.organization && (
              <TruncateText variant="h6" tone="secondary">
                {row.original.organization}
              </TruncateText>
            )}
          </div>
        ),
        enableSorting: false,
        filterFn: multiSelectFilterFn,
        meta: liveColumnMeta(EXECUTION_COLUMNS.machineId, { filter: { options: machineOptions } }),
      },
      {
        // accessorKey is `initiatorId` so the filter option values (user ids)
        // match the `initiatorIds` server filter; the cell still renders the name.
        accessorKey: 'initiatorId',
        header: 'Executed by',
        // The initiator id is a User global id; decode it to the raw id the
        // REST-backed employee page expects. When present, the avatar + name open
        // that user's page in a new tab (accent + underline). `data-no-row-click`
        // stops the row's own navigation (to the execution) so only the user opens.
        cell: ({ row }: { row: Row<UiExecution> }) => {
          const rawInitiatorId = row.original.initiatorId
            ? (decodeGlobalId(row.original.initiatorId)?.rawId ?? row.original.initiatorId)
            : '';
          const href = rawInitiatorId ? employeeDetailHref(rawInitiatorId) : null;
          const isDeleted = row.original.initiatorDeleted;

          return (
            <div className="flex flex-1 items-center gap-[var(--spacing-system-xsf)] min-w-0">
              {isDeleted ? (
                <DeletedUserAvatar size="md" />
              ) : (
                <SquareAvatar
                  variant="round"
                  size="md"
                  src={row.original.initiatorImage}
                  fallback={row.original.initiatorInitials}
                  alt={row.original.initiatorName}
                  initialsClassName="text-ods-text-secondary"
                />
              )}
              {/* min-w-0 flex-1 so the FloatingTooltip's block div can shrink and the text ellipsizes. */}
              <div className="flex flex-col justify-center min-w-0 flex-1">
                {/* Name and the source chip share the first line: a schedule or
                    Mingo dispatches on a technician's behalf, so the chip
                    qualifies the name instead of standing in for it. The name is
                    the part that ellipsizes — the chip keeps its width. */}
                <div className="flex items-center gap-[var(--spacing-system-xxs)] min-w-0">
                  {href ? (
                    // Only the NAME opts out of the row link — the rest of the cell
                    // still navigates to the execution, like every other cell.
                    <button
                      data-no-row-click
                      type="button"
                      onClick={openInNewTab(href)}
                      className="min-w-0 text-left pointer-events-auto"
                    >
                      <TruncateText className={cn('underline', isDeleted ? 'text-ods-error' : 'text-ods-accent')}>
                        {row.original.initiatorName}
                      </TruncateText>
                    </button>
                  ) : (
                    <TruncateText className={isDeleted ? 'text-ods-error' : undefined}>
                      {row.original.initiatorName}
                    </TruncateText>
                  )}
                  <ExecutionSourceBadge source={row.original.source} />
                </div>
                {row.original.scriptName && (
                  <TruncateText variant="h6" tone="secondary">
                    {row.original.scriptName}
                  </TruncateText>
                )}
              </div>
            </div>
          );
        },
        enableSorting: false,
        filterFn: multiSelectFilterFn,
        meta: liveColumnMeta(EXECUTION_COLUMNS.initiatorId, { filter: { options: initiatorOptions } }),
      },
      {
        accessorKey: 'result',
        header: 'Result',
        cell: ({ row }: { row: Row<UiExecution> }) => (
          <TruncateText lines={2}>{row.original.result || '—'}</TruncateText>
        ),
        enableSorting: false,
        meta: liveColumnMeta(EXECUTION_COLUMNS.result),
      },
      {
        id: 'actions',
        cell: ({ row }: { row: Row<UiExecution> }) => (
          <div data-no-row-click className="flex gap-2 items-center justify-end pointer-events-auto">
            {renderRowActions(row.original)}
          </div>
        ),
        enableSorting: false,
        meta: liveColumnMeta(EXECUTION_COLUMNS.actions),
      },
      {
        id: 'open',
        cell: ({ row }: { row: Row<UiExecution> }) => (
          <div data-no-row-click className="flex items-center justify-end pointer-events-auto">
            <Button
              onClick={() => router.push(executionHref(row.original))}
              variant="outline"
              size="icon"
              leftIcon={<ArrowRightUpIcon className="w-5 h-5" />}
              aria-label="Open execution details"
              className="bg-ods-card"
            />
          </div>
        ),
        enableSorting: false,
        meta: liveColumnMeta(EXECUTION_COLUMNS.open),
      },
    ],
    [renderRowActions, router, executionHref, statusOptions, initiatorOptions, machineOptions, dateFilter],
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
  const showHeader = executions.length > 0 || hasActiveFilter || isPending;

  // `emptyState` claims nothing ever ran — only true without an active
  // search/filter; otherwise it's the narrowing that produced the empty result,
  // and the table's own "no results" placeholder is what says so.
  //
  // `hasNext` wins over both: an empty list with pages still to come is a list
  // being narrowed CLIENT-side (the server can't have returned zero rows and a
  // next page), and "nothing matched" would be a claim we can't make yet — the
  // footer below is still pulling the pages that might.
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
  const isEmptyState = executions.length === 0 && !search && !hasActiveFilter && !hasNext && !isPending;
  useEffect(() => {
    onEmptyChange?.(isEmptyState);
  }, [isEmptyState, onEmptyChange]);
  // Restore it on the way out: this table unmounts whenever its query re-suspends,
  // and a toolbar hidden by a list that is no longer rendered would never return.
  useEffect(() => () => onEmptyChange?.(false), [onEmptyChange]);

  return (
    <>
      {/* Dim (don't unmount) the stale rows while a deferred refetch is in
          flight — the subtle fade is the pending feedback. */}
      <div className={`transition-opacity duration-200 ${isPending ? 'opacity-60' : ''}`}>
        <DataTable table={table}>
          {showHeader && (
            <DataTable.Header stickyHeader stickyHeaderOffset={stickyHeaderOffset} rightSlot={<DataTable.RowCount />} />
          )}
          <DataTable.Body
            skeletonRows={EXECUTIONS_PAGE_SIZE}
            emptyState={resolvedEmptyState}
            rowClassName="mb-1"
            rowHref={executionHref}
          />
          {/* Kept mounted on an EMPTY list too, as long as more pages exist —
              that only happens under client-side narrowing, and there the
              sentinel is what walks the rest of the pages so the term ends up
              searching the whole list instead of just the first page. */}
          {(executions.length > 0 || hasNext) && (
            <DataTable.InfiniteFooter
              hasNextPage={hasNext}
              isFetchingNextPage={isLoadingNext}
              onLoadMore={onLoadMore}
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
// Skeleton
// ----------------------------------------------------------------

const EMPTY_ROWS: UiExecution[] = [];

export function ExecutionsSkeleton({ stickyHeaderOffset }: { stickyHeaderOffset?: string } = {}) {
  // The live table's own layout, with `skeletonColumnMeta` turning `filterable`
  // into a filter with no options yet — the header then draws the real control,
  // funnel included, instead of growing one when the facets land. The Execution
  // header gets the same treatment by hand: its calendar needs no data, so
  // drawing it inert here is what keeps the label from shifting when the rows
  // arrive and the real popover replaces it.
  const columns = useMemo<ColumnDef<UiExecution>[]>(
    () =>
      EXECUTION_COLUMN_ORDER.map(column => {
        const label = column.header;
        return {
          id: column.id,
          header: column.dateFilterable && label ? () => <DateColumnHeader label={label} /> : label,
          enableSorting: false,
          meta: skeletonColumnMeta(column),
        };
      }),
    [],
  );

  const table = useDataTable<UiExecution>({
    data: EMPTY_ROWS,
    columns,
    getRowId: (row: UiExecution) => row.id,
    enableSorting: false,
  });

  return (
    <DataTable table={table}>
      <DataTable.Header stickyHeader stickyHeaderOffset={stickyHeaderOffset} />
      <DataTable.Body loading={true} skeletonRows={EXECUTIONS_PAGE_SIZE} emptyMessage="" rowClassName="mb-1" />
    </DataTable>
  );
}

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
}

/**
 * URL-backed filter/search state + the sticky search toolbar + the Suspense
 * boundary around the Relay content. Every executions list renders this — the
 * per-script tab, the per-schedule tab and the Schedule Run Details page — and
 * supplies only the query wiring through `children`.
 */
export function ExecutionsTabShell({
  children,
  clientSearch,
}: {
  children: (state: ExecutionsTabState) => ReactNode;
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
}) {
  const { toolbarRef, containerStyle, stickyHeaderOffset } = useStickyToolbar();
  const { params, setParam, setParams } = useApiParams({
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
  });
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
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
  const queryVars = useMemo(() => {
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

  // Deferred query variables: on a filter/search interaction the table keeps
  // rendering the current rows while the refetch is in flight, instead of
  // dropping to the Suspense skeleton. The dropdown state (`tableFilters`) stays
  // live so the checkboxes respond instantly.
  const { deferredFilters: deferredVars, deferredSearch, isPending } = useDeferredQuery(queryVars, debouncedSearch);

  const tableFilters = useMemo(
    () => ({ status: params.status, machineId: params.machineId, initiatorId: params.initiatorId }),
    [params.status, params.machineId, params.initiatorId],
  );

  const handleFilterChange = useCallback(
    (columnFilters: Record<string, string[]>) => {
      setParams({
        status: columnFilters.status || [],
        machineId: columnFilters.machineId || [],
        initiatorId: columnFilters.initiatorId || [],
      });
      document.querySelector('main')?.scrollTo({ top: 0, behavior: 'instant' });
    },
    [setParams],
  );

  // Apply (and Reset, which fires with the cleared selection). `sortDir: ''` —
  // NOT `'desc'` — for the default direction: `useApiParams` drops a param only
  // when the value is empty, so writing `'desc'` would leave `?sortDir=desc`
  // behind on a list in its default order. Reading it back still yields `desc`.
  const handleDateFilterApply = useCallback(
    (result: DateFilterResult) => {
      setParams({
        sortDir: result.sort === 'desc' ? '' : result.sort,
        dateFrom: result.range?.from ? toDayParam(result.range.from) : '',
        dateTo: result.range?.to ? toDayParam(result.range.to) : '',
      });
      document.querySelector('main')?.scrollTo({ top: 0, behavior: 'instant' });
    },
    [setParams],
  );

  const dateFilter: TableDateFilter = useMemo(
    () => ({ sortDirection, range: dateRange, onApply: handleDateFilterApply }),
    [sortDirection, dateRange, handleDateFilterApply],
  );

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
          className="sticky top-0 z-20 flex items-center gap-[var(--spacing-system-m)] bg-ods-bg pt-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
        >
          <div className="flex-1">
            <Input
              placeholder="Search for Executions"
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
      <Suspense fallback={<ExecutionsSkeleton stickyHeaderOffset={stickyHeaderOffset} />}>
        {children({
          backendFilters: deferredVars.filter,
          sort: deferredVars.sort,
          // A caller whose `search` is spoken for gets the typed term as
          // client-side narrowing instead. Everywhere else it is the query's own
          // term and nothing is narrowed twice.
          querySearch: clientSearch ? '' : deferredSearch,
          narrowSearch: clientSearch ? deferredSearch : '',
          isPending,
          tableFilters,
          onFilterChange: handleFilterChange,
          dateFilter,
          mobileFilterOpen,
          onMobileFilterClose: () => setMobileFilterOpen(false),
          stickyHeaderOffset,
          onEmptyChange: setIsEmpty,
        })}
      </Suspense>
    </div>
  );
}
