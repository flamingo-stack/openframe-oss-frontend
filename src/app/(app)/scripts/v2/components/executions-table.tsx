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
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { useRouter } from 'next/navigation';
import { type ReactNode, Suspense, useCallback, useMemo, useState } from 'react';
import type { ScriptExecutionFilterInput } from '@/__generated__/scriptExecutionsRelayQuery.graphql';
import { employeeDetailHref } from '@/app/(app)/settings/employees/routes';
import { useDeferredQuery } from '@/app/hooks/use-deferred-query';
import { useSearchParam } from '@/app/hooks/use-search-param';
import { useStickyToolbar } from '@/app/hooks/use-sticky-toolbar';
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

export type { ScriptExecutionFilterInput };

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
  /**
   * Which script this execution ran — the second line under the initiator.
   * Empty unless the operation selects it: the schedule tab does (a schedule
   * runs several scripts), the script tab doesn't (it would repeat its title).
   */
  scriptName: string;
  result: string;
}

/**
 * A `ScriptExecution` node as selected by either operation — typed
 * structurally so one mapper serves both generated artifacts.
 */
export interface ExecutionNodeLike {
  readonly id: string;
  readonly executionId: string;
  readonly status: string;
  readonly dispatchedAt: unknown;
  readonly scriptName?: string | null;
  readonly stdout?: string | null;
  readonly stderr?: string | null;
  readonly error?: string | null;
  readonly machine?: {
    readonly machineId?: string | null;
    readonly hostname?: string | null;
    readonly displayName?: string | null;
    readonly organization?: { readonly name?: string | null } | null;
  } | null;
  readonly initiator?: {
    readonly id: string;
    readonly firstName?: string | null;
    readonly lastName?: string | null;
    readonly email?: string | null;
    readonly image?: { readonly imageUrl?: string | null; readonly hash?: string | null } | null;
  } | null;
}

export function toUiExecution(node: ExecutionNodeLike): UiExecution {
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
    scriptName: node.scriptName ?? '',
    result: executionResultText(node),
  };
}

/** Server facet entry (`ScriptFilterOption`), typed structurally for both artifacts. */
type FacetEntries = ReadonlyArray<{ readonly value: string; readonly label: string }> | null | undefined;

export interface ExecutionFacets {
  readonly statuses?: FacetEntries;
  readonly initiators?: FacetEntries;
  readonly machines?: FacetEntries;
}

export interface ExecutionFacetOptions {
  statusOptions: FacetOption[];
  machineOptions: FacetOption[];
  initiatorOptions: FacetOption[];
}

/**
 * Server facets → dropdown options. Status values are raw enums, mapped through
 * the shared label helper ("SUCCESS" → "Completed") and kept in the backend's
 * by-count order; the other two are label-sorted.
 */
export function useExecutionFacetOptions(facets: ExecutionFacets | null | undefined): ExecutionFacetOptions {
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
  /** Empty-state copy when nothing is searched or filtered. */
  emptyHint: string;
  /** Pins the column header flush below the sticky search toolbar. */
  stickyHeaderOffset: string;
  mobileFilterOpen: boolean;
  onMobileFilterClose: () => void;
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
  emptyHint,
  stickyHeaderOffset,
  mobileFilterOpen,
  onMobileFilterClose,
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
        header: 'Execution',
        cell: ({ row }: { row: Row<UiExecution> }) => (
          <div className="flex flex-col justify-center gap-1 min-w-0">
            <TruncateText>{row.original.timestamp}</TruncateText>
            <TruncateText variant="h6" tone="secondary">
              {row.original.executionId}
            </TruncateText>
          </div>
        ),
        enableSorting: false,
        meta: { width: 'w-[160px]' },
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
        meta: { width: 'w-[120px]', filter: { options: statusOptions } },
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
        meta: { width: 'w-[200px]', hideAt: 'lg', filter: { options: machineOptions } },
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

          return (
            <div className="flex flex-1 items-center gap-2 min-w-0">
              <SquareAvatar
                variant="round"
                size="md"
                src={row.original.initiatorImage}
                fallback={row.original.initiatorInitials}
                alt={row.original.initiatorName}
                initialsClassName="text-ods-text-secondary"
              />
              {/* min-w-0 flex-1 so the FloatingTooltip's block div can shrink and the text ellipsizes. */}
              <div className="flex flex-col justify-center min-w-0 flex-1">
                {href ? (
                  // Only the NAME opts out of the row link — the rest of the cell
                  // still navigates to the execution, like every other cell.
                  <button
                    data-no-row-click
                    type="button"
                    onClick={openInNewTab(href)}
                    className="min-w-0 text-left pointer-events-auto"
                  >
                    <TruncateText className="text-ods-accent underline">{row.original.initiatorName}</TruncateText>
                  </button>
                ) : (
                  <TruncateText>{row.original.initiatorName}</TruncateText>
                )}
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
        meta: {
          width: 'flex-1 min-w-0',
          hideAt: 'md',
          filter: { options: initiatorOptions },
        },
      },
      {
        accessorKey: 'result',
        header: 'Result',
        cell: ({ row }: { row: Row<UiExecution> }) => (
          <TruncateText lines={2}>{row.original.result || '—'}</TruncateText>
        ),
        enableSorting: false,
        meta: { width: 'flex-1 min-w-0', hideAt: 'xl' },
      },
      {
        id: 'actions',
        cell: ({ row }: { row: Row<UiExecution> }) => (
          <div data-no-row-click className="flex gap-2 items-center justify-end pointer-events-auto">
            {renderRowActions(row.original)}
          </div>
        ),
        enableSorting: false,
        meta: { width: 'w-12 shrink-0 flex-none', align: 'right' },
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
        meta: { width: 'w-12 shrink-0 flex-none', hideAt: 'md', align: 'right' },
      },
    ],
    [renderRowActions, router, executionHref, statusOptions, initiatorOptions, machineOptions],
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
  const hasActiveFilter = columnFilters.length > 0;
  const showHeader = executions.length > 0 || hasActiveFilter || isPending;

  // The default copy claims nothing ever ran — only true without an active
  // search/filter; otherwise it's the narrowing that produced the empty result.
  const emptyMessage = search
    ? `No executions found matching "${search}". Try adjusting your search.`
    : hasActiveFilter
      ? 'No executions match the current filters. Try adjusting them.'
      : emptyHint;

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
            emptyMessage={emptyMessage}
            rowClassName="mb-1"
            rowHref={executionHref}
          />
          {executions.length > 0 && (
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
      />
    </>
  );
}

// ----------------------------------------------------------------
// Skeleton
// ----------------------------------------------------------------

const EMPTY_ROWS: UiExecution[] = [];

export function ExecutionsSkeleton({ stickyHeaderOffset }: { stickyHeaderOffset?: string } = {}) {
  const columns = useMemo<ColumnDef<UiExecution>[]>(
    () => [
      { accessorKey: 'executionId', header: 'Execution', enableSorting: false, meta: { width: 'w-[160px]' } },
      { accessorKey: 'status', header: 'Status', enableSorting: false, meta: { width: 'w-[120px]' } },
      {
        accessorKey: 'machineName',
        header: 'Device',
        enableSorting: false,
        meta: { width: 'w-[200px]', hideAt: 'lg' },
      },
      {
        accessorKey: 'initiatorName',
        header: 'Executed by',
        enableSorting: false,
        meta: { width: 'flex-1 min-w-0', hideAt: 'md' },
      },
      {
        accessorKey: 'result',
        header: 'Result',
        enableSorting: false,
        meta: { width: 'flex-1 min-w-0', hideAt: 'xl' },
      },
    ],
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
  debouncedSearch: string;
  isPending: boolean;
  tableFilters: Record<string, string[]>;
  onFilterChange: (filters: Record<string, string[]>) => void;
  mobileFilterOpen: boolean;
  onMobileFilterClose: () => void;
  stickyHeaderOffset: string;
}

/**
 * URL-backed filter/search state + the sticky search toolbar + the Suspense
 * boundary around the Relay content. Both executions tabs render this and only
 * supply the query wiring through `children`.
 */
export function ExecutionsTabShell({
  children,
  scopeSearch,
}: {
  children: (state: ExecutionsTabState) => ReactNode;
  /**
   * Pins the list to one server-side search term and hides the search box.
   * For the Schedule Run Details page, which shows the executions of ONE fire:
   * the only handle the API offers for that is `search` on the run's
   * `executionId` (`ScriptExecutionFilterInput` has no execution-id field), so a
   * user-typed term would REPLACE the scope and silently widen the page to the
   * whole schedule. The column funnels still work — they travel in `filter`, so
   * they compose with the scope instead of competing with it.
   */
  scopeSearch?: string;
}) {
  const { toolbarRef, containerStyle, stickyHeaderOffset } = useStickyToolbar();
  const { params, setParam, setParams } = useApiParams({
    search: { type: 'string', default: '' },
    status: { type: 'array', default: [] },
    machineId: { type: 'array', default: [] },
    initiatorId: { type: 'array', default: [] },
  });
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // Local search input keeps typing responsive; debounced into the URL param.
  const {
    search: searchInput,
    setSearch: setSearchInput,
    debouncedSearch,
  } = useSearchParam(params.search, value => setParam('search', value), 300);

  const backendFilters: ScriptExecutionFilterInput = useMemo(
    () => ({
      ...(params.status.length > 0 && { statuses: params.status as ScriptExecutionFilterInput['statuses'] }),
      ...(params.machineId.length > 0 && { machineIds: params.machineId }),
      ...(params.initiatorId.length > 0 && { initiatorIds: params.initiatorId }),
    }),
    [params.status, params.machineId, params.initiatorId],
  );

  // Deferred query variables: on a filter/search interaction the table keeps
  // rendering the current rows while the refetch is in flight, instead of
  // dropping to the Suspense skeleton. The dropdown state (`tableFilters`) stays
  // live so the checkboxes respond instantly.
  const { deferredFilters, deferredSearch, isPending } = useDeferredQuery(backendFilters, debouncedSearch);

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

  return (
    // The negative `-mt-lf` cancels the `gap-lf` the parent (the details view)
    // puts between the tab bar and this content: TabNavigation renders as a
    // fragment, so its tab bar and this body are sibling flex items and the gap
    // leaks in as a top offset. Without this it stacks with the toolbar's `pt-l`
    // below → doubled top padding.
    <div className="flex flex-col -mt-[var(--spacing-system-lf)]" style={containerStyle}>
      {/* Search stays pinned to the top of the scroll area; its measured height
          feeds the sticky column header offset. `pt-l` sits above the input (and,
          once the `-mt-6` cancels the parent gap, is the sole top spacing), `pb-l`
          separates it from the table below — the `bg-ods-bg` hides rows scrolling
          underneath while the toolbar is pinned. */}
      <div
        ref={toolbarRef}
        className={cn(
          'sticky top-0 z-20 flex items-center gap-[var(--spacing-system-xs)] bg-ods-bg pt-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]',
          // Scoped: nothing left to show on desktop once the search box is gone,
          // so the strip collapses entirely (a measured height of 0 also zeroes
          // the sticky header offset). Mobile keeps it for the funnel button,
          // which has no other home on that breakpoint.
          scopeSearch && 'md:hidden',
        )}
      >
        {!scopeSearch && (
          <div className="flex-1">
            <Input
              placeholder="Search for Executions"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              startAdornment={<SearchIcon className="w-4 h-4 md:w-6 md:h-6" />}
            />
          </div>
        )}
        <Button
          variant="outline"
          size="icon"
          className={cn('md:hidden', scopeSearch && 'ml-auto')}
          onClick={() => setMobileFilterOpen(true)}
          aria-label="Open filters"
          leftIcon={<Filter02Icon />}
        />
      </div>
      <Suspense fallback={<ExecutionsSkeleton stickyHeaderOffset={stickyHeaderOffset} />}>
        {children({
          backendFilters: deferredFilters,
          debouncedSearch: scopeSearch ?? deferredSearch,
          isPending,
          tableFilters,
          onFilterChange: handleFilterChange,
          mobileFilterOpen,
          onMobileFilterClose: () => setMobileFilterOpen(false),
          stickyHeaderOffset,
        })}
      </Suspense>
    </div>
  );
}
