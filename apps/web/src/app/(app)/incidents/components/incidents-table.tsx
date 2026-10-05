'use client';

import { MingoIcon } from '@flamingo-stack/openframe-frontend-core/components/icons';
import {
  ArrowRightUpIcon,
  Filter02Icon,
  SearchIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  ActionsMenuDropdown,
  Button,
  type ColumnDef,
  DataTable,
  FilterModal,
  Input,
  PageLayout,
  type Row,
  TruncateText,
  useDataTable,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useApiParams, useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { defineParamSchema, formatRelativeTime } from '@flamingo-stack/openframe-frontend-core/utils';
import { type ReactNode, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchQuery,
  readInlineData,
  useLazyLoadQuery,
  useMutation,
  usePaginationFragment,
  useRelayEnvironment,
} from 'react-relay';
import type { archiveResolvedInsightsMutation as ArchiveResolvedInsightsMutationType } from '@/__generated__/archiveResolvedInsightsMutation.graphql';
import type { incidentsTableRelay_query$key as IncidentsFragmentKey } from '@/__generated__/incidentsTableRelay_query.graphql';
import type { incidentsTableRelayPaginationQuery as IncidentsPaginationQueryType } from '@/__generated__/incidentsTableRelayPaginationQuery.graphql';
import type {
  incidentsTableRelayQuery as IncidentsTableQueryType,
  InsightFilter,
} from '@/__generated__/incidentsTableRelayQuery.graphql';
import type { insightFacets_filters$key as InsightFacetsKey } from '@/__generated__/insightFacets_filters.graphql';
import { EmptyState, liveColumnMeta, skeletonColumnDefs, useRetryKey } from '@/app/components/shared';
import { ConfirmDialog } from '@/app/components/shared/confirm-dialog';
import { renderDeviceTypeIcon } from '@/app/components/shared/device-type-icon';
import type { TableSkeletonColumn } from '@/app/components/shared/table-column-layout';
import { useDeferredQuery } from '@/app/hooks/use-deferred-query';
import { useSearchParam } from '@/app/hooks/use-search-param';
import { useStickyToolbar } from '@/app/hooks/use-sticky-toolbar';
import { InsightSeverity, InsightStatus, InsightType } from '@/generated/schema-enums';
import { archiveResolvedInsightsMutation } from '@/graphql/insights/archive-resolved-insights-mutation';
import { incidentsTableRelayFragment, incidentsTableRelayQuery } from '@/graphql/insights/incidents-table-relay';
import { insightFacetsFragment } from '@/graphql/insights/insight-facets';
import { formatDateTime } from '@/lib/format-date';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import { openInNewTab } from '@/lib/open-in-new-tab';
import { pluralize } from '@/lib/pluralize';
import { type IncidentsTab, routes } from '@/lib/routes';
import { multiSelectFilterFn } from '@/lib/table-filters';
import { type FacetEntry, type FacetOption, facetToSortedOptions } from '../../scripts/shared/utils/facet-options';
import { type MingoAction, mingoActionFor, useFixWithMingo } from '../hooks/use-fix-with-mingo';
import { useLatestIncidentDialogs } from '../hooks/use-incident-dialogs';
import { useIncidentTransitions } from '../hooks/use-incident-transitions';
import {
  enumMembers,
  ALL_INCIDENT_STATUSES,
  INCIDENT_SEVERITY_LABELS,
  INCIDENT_STATUS_LABELS,
  INCIDENT_TYPE_LABELS,
  labelOf,
  WORKING_SET_STATUSES,
} from '../utils/incident-labels';
import { type IncidentRow, toIncidentRow, toTransitionTable } from '../utils/incident-transform';
import { IncidentAssignee } from './incident-assignee';
import { IncidentSeverityTag, IncidentStatusTag } from './incident-tags';
import { DEVICE_INCIDENTS_TABLE_COLUMNS, INCIDENT_COLUMNS } from './incidents-table-columns';
import { archiveResolvedAction, INCIDENT_TAB_VIEWS } from './incidents-tabs';
import { SnoozeIncidentModal } from './snooze-incident-modal';
import { transitionMenuItems } from './transition-menu-items';

const PAGE_SIZE = 20;

/**
 * TanStack's column-filter state as `useDataTable` hands it back. Declared
 * structurally rather than imported: @tanstack/react-table is the core library's
 * dependency, not this app's.
 */
type ColumnFilterState = { id: string; value: unknown }[];

/**
 * A row plus everything its Mingo button draws. It rides IN the row data rather
 * than in the column defs on purpose: `DataTableRow` is memoized on the row
 * object, which TanStack keeps stable across column changes, so a cell reading
 * any value from the columns' closure keeps showing what it saw first. The
 * `rows` memo below rebuilds on every input of the action.
 */
interface IncidentTableRow extends IncidentRow {
  mingoAction: MingoAction;
}

/**
 * Dropdown options for an enum facet, labelled with this app's names so the
 * dropdown matches the cells; server order is kept. (The customer facet keeps
 * the server label — the organization name — via `facetToSortedOptions`.)
 */
function enumFacetOptions(facet: readonly FacetEntry[], labels: Record<string, string>): FacetOption[] {
  return facet.map(f => ({ id: f.value, label: labelOf(labels, f.value), value: f.value, count: f.count }));
}

/**
 * The line under the status tag. A NEW incident shows its age ("4 minutes"),
 * a snoozed one when it comes back; everything else the detection time — the
 * API has no status-changed timestamp yet.
 */
function statusTime(row: IncidentRow): string {
  if (row.status === InsightStatus.NEW) {
    return formatRelativeTime(row.detectedAt);
  }
  if (row.status === InsightStatus.SNOOZED && row.snoozedUntil) {
    return formatDateTime(row.snoozedUntil);
  }
  return formatDateTime(row.detectedAt);
}

// ----------------------------------------------------------------
// Inner content — Relay hooks, must live inside Suspense
// ----------------------------------------------------------------

interface IncidentsTableContentProps {
  backendFilters: InsightFilter;
  debouncedSearch: string;
  tableFilters: Record<string, string[]>;
  /**
   * True while the deferred query variables lag the live filter/search state
   * (a refetch is in flight and the rows on screen are the previous result) —
   * guards the empty state so it never flashes on stale data.
   */
  isPending: boolean;
  onFilterChange: (filters: Record<string, string[]>) => void;
  onEmptyChange: (isEmpty: boolean) => void;
  mobileFilterOpen: boolean;
  onMobileFilterClose: () => void;
  stickyHeaderOffset: string;
  /**
   * The list is one device's (the device page's Incidents tab): the Device
   * column and its Customer filter go, since every row names the same machine
   * and so the same customer.
   */
  deviceScoped: boolean;
  /**
   * The statuses this list covers — a status tab's, or every status for the
   * device tab. The Status filter offers only these, and none at all for a
   * single-status tab (Snoozed, Archived), where every row has the same one.
   */
  statuses: readonly InsightStatus[];
  /** Bumped by the caller to refetch the list — after a write the store cannot see, like Archive Resolved. */
  refreshKey: number;
  /** What a list with no incidents at all shows in place of the table. */
  emptyState: ReactNode;
}

function IncidentsTableContent({
  backendFilters,
  debouncedSearch,
  tableFilters,
  isPending,
  onFilterChange,
  onEmptyChange,
  mobileFilterOpen,
  onMobileFilterClose,
  stickyHeaderOffset,
  deviceScoped,
  statuses,
  refreshKey,
  emptyState,
}: IncidentsTableContentProps) {
  const { toast } = useToast();
  const mingoControls = useFixWithMingo();

  // One round-trip per interaction: the filter facets (`insightFilters`) ride the
  // list operation — see the query docstring for the facet semantics.
  const environment = useRelayEnvironment();
  const retryKey = useRetryKey();
  const fetchKey = `${retryKey}:${refreshKey}`;
  const queryData = useLazyLoadQuery<IncidentsTableQueryType>(
    incidentsTableRelayQuery,
    {
      filter: backendFilters,
      search: debouncedSearch || null,
      first: PAGE_SIZE,
      after: null,
    },
    { fetchPolicy: 'store-and-network', fetchKey },
  );

  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    IncidentsPaginationQueryType,
    IncidentsFragmentKey
  >(incidentsTableRelayFragment, queryData);

  // Manual memos on purpose: TanStack compares `data` by identity, so `rows`
  // must only change when an input does — and `incidents` is its stable input.
  const incidents = useMemo<IncidentRow[]>(
    () => (data.insights?.edges ?? []).flatMap(edge => (edge?.node ? [toIncidentRow(edge.node)] : [])),
    [data.insights?.edges],
  );
  // Which rows already have a chat: their button reopens it instead of starting one.
  const mingoSessions = useLatestIncidentDialogs(incidents.map(row => row.insightId));
  const rows = useMemo<IncidentTableRow[]>(
    () =>
      incidents.map(row => ({ ...row, mingoAction: mingoActionFor(row, mingoSessions[row.insightId], mingoControls) })),
    [incidents, mingoSessions, mingoControls],
  );

  // A failed page must stop the footer: its sentinel stays in view, Relay
  // clears `isLoadingNext` on the error, and the observer would ask again at
  // once — hundreds of identical failing requests a second against a backend
  // that just said no. One toast, then the footer goes quiet. Recorded against
  // the variables it failed for: this component stays mounted across filter,
  // search and refetch changes, and a new list gets its own footer. Compared by
  // identity on purpose — `backendFilters` is memoized upstream and only
  // changes with the URL params, so a re-render cannot revive the footer.
  const [failedPage, setFailedPage] = useState<{ filter: InsightFilter; search: string; fetchKey: string } | null>(
    null,
  );
  const pageFailed =
    failedPage !== null &&
    failedPage.filter === backendFilters &&
    failedPage.search === debouncedSearch &&
    failedPage.fetchKey === fetchKey;
  const fetchNextPage = () => {
    if (!hasNext || isLoadingNext || pageFailed) return;
    loadNext(PAGE_SIZE, {
      onComplete: error => {
        if (!error) return;
        setFailedPage({ filter: backendFilters, search: debouncedSearch, fetchKey });
        toast({
          title: 'Error',
          description: getRelayErrorMessage(error, 'Failed to load more incidents'),
          variant: 'destructive',
        });
      },
    });
  };

  const facets = readInlineData<InsightFacetsKey>(insightFacetsFragment, queryData.insightFilters);
  const typeOptions = enumFacetOptions(facets.types, INCIDENT_TYPE_LABELS);
  const severityOptions = enumFacetOptions(facets.severities, INCIDENT_SEVERITY_LABELS);
  const statusLocked = statuses.length === 1;
  const inScope = new Set<string>(statuses);
  const scopedStatusFacet = facets.statuses.filter(option => inScope.has(option.value));
  const statusOptions = enumFacetOptions(scopedStatusFacet, INCIDENT_STATUS_LABELS);
  const customerOptions = facetToSortedOptions(facets.organizationIds);
  const assigneeOptions = facetToSortedOptions(facets.assigneeIds);
  const filteredCount = facets.filteredCount ?? undefined;
  // The status facet is narrowed by every filter EXCEPT status, so it counts the
  // list's statuses even where the default leaves some out — the device tab's
  // ARCHIVED: a device whose incidents are all filed away has "no rows" but is
  // not empty, and keeps the filters. Counting only the list's own statuses is
  // what makes a status tab empty when that status is.
  const hasAnyIncident = scopedStatusFacet.some(option => option.count > 0);

  // A transition can take a row out of this list (Snooze on Current, Reopen on
  // Archived) and moves the counts it was aggregated into, while its payload
  // rewrites only the one record. Refetch every loaded row — the first page
  // alone would collapse a scrolled list — into the same connection and facet
  // records. Imperative on purpose: a failed refresh toasts, where a failed
  // render-time refetch would swap the tab for the error card.
  const loadedCount = data.insights?.edges?.length ?? 0;
  const refreshAfterTransition = () => {
    fetchQuery<IncidentsTableQueryType>(
      environment,
      incidentsTableRelayQuery,
      { filter: backendFilters, search: debouncedSearch || null, first: Math.max(PAGE_SIZE, loadedCount), after: null },
      { fetchPolicy: 'network-only' },
    ).subscribe({
      error: (error: Error) => {
        toast({
          title: 'Error',
          description: getRelayErrorMessage(error, 'Failed to refresh incidents'),
          variant: 'destructive',
        });
      },
    });
  };

  const { transition, snoozeTarget, cancelSnooze, confirmSnooze, isMutating, isSnoozing } =
    useIncidentTransitions(refreshAfterTransition);
  const transitionTable = toTransitionTable(queryData);

  const columns = useMemo<ColumnDef<IncidentTableRow>[]>(() => {
    const renderRowActions = (row: IncidentRow) => {
      const items = transitionMenuItems(row, transitionTable, transition, isMutating);
      return items.length > 0 ? <ActionsMenuDropdown groups={[{ items }]} /> : null;
    };
    // The Device column filters by CUSTOMER (its second line): the API has no
    // device facet, and a customer narrows the fleet the way a technician does.
    const deviceColumn: ColumnDef<IncidentTableRow> = {
      accessorKey: 'organizationId',
      header: INCIDENT_COLUMNS.device.header,
      cell: ({ row }: { row: Row<IncidentTableRow> }) => (
        <div className="flex min-w-0 flex-col justify-center gap-[var(--spacing-system-xxs)]">
          <div className="flex min-w-0 items-center gap-[var(--spacing-system-xxs)]">
            {renderDeviceTypeIcon(row.original.deviceType ?? undefined, 'size-6 shrink-0 text-ods-text-secondary')}
            <div className="min-w-0 flex-1">
              <TruncateText>{row.original.deviceName}</TruncateText>
            </div>
          </div>
          {row.original.organizationName && (
            <TruncateText variant="h6" tone="secondary">
              {row.original.organizationName}
            </TruncateText>
          )}
        </div>
      ),
      enableSorting: false,
      filterFn: multiSelectFilterFn,
      meta: liveColumnMeta(INCIDENT_COLUMNS.device, { filter: { options: customerOptions } }),
    };
    return [
      {
        accessorKey: 'type',
        header: INCIDENT_COLUMNS.incident.header,
        cell: ({ row }: { row: Row<IncidentTableRow> }) => (
          <div className="flex min-w-0 flex-col justify-center gap-[var(--spacing-system-xxs)]">
            <TruncateText>{row.original.title}</TruncateText>
            {/* The Status column is hidden below lg; its time line moves under the title. */}
            <div className="hidden min-w-0 lg:block">
              <TruncateText variant="h6" tone="secondary">
                {labelOf(INCIDENT_TYPE_LABELS, row.original.type)}
              </TruncateText>
            </div>
            <div className="min-w-0 lg:hidden">
              <TruncateText variant="h6" tone="secondary">
                {statusTime(row.original)}
              </TruncateText>
            </div>
          </div>
        ),
        enableSorting: false,
        filterFn: multiSelectFilterFn,
        meta: liveColumnMeta(INCIDENT_COLUMNS.incident, { filter: { options: typeOptions } }),
      },
      ...(deviceScoped ? [] : [deviceColumn]),
      {
        accessorKey: 'severity',
        header: INCIDENT_COLUMNS.severity.header,
        // The cell is a column flexbox, so a bare Tag stretches to the column
        // width — `items-start` keeps it at its own width, as in the Status cell.
        cell: ({ row }: { row: Row<IncidentTableRow> }) => (
          <div className="flex flex-col items-start">
            <IncidentSeverityTag severity={row.original.severity} />
          </div>
        ),
        enableSorting: false,
        filterFn: multiSelectFilterFn,
        meta: liveColumnMeta(INCIDENT_COLUMNS.severity, { filter: { options: severityOptions } }),
      },
      {
        accessorKey: 'status',
        header: INCIDENT_COLUMNS.status.header,
        cell: ({ row }: { row: Row<IncidentTableRow> }) => (
          <div className="flex min-w-0 flex-col items-start justify-center gap-[var(--spacing-system-xxs)]">
            <IncidentStatusTag status={row.original.status} />
            <TruncateText variant="h6" tone="secondary">
              {statusTime(row.original)}
            </TruncateText>
          </div>
        ),
        enableSorting: false,
        filterFn: multiSelectFilterFn,
        meta: statusLocked
          ? liveColumnMeta(INCIDENT_COLUMNS.status)
          : liveColumnMeta(INCIDENT_COLUMNS.status, { filter: { options: statusOptions } }),
      },
      {
        id: INCIDENT_COLUMNS.assignee.id,
        accessorFn: (row: IncidentTableRow) => row.assignee?.id,
        header: INCIDENT_COLUMNS.assignee.header,
        cell: ({ row }: { row: Row<IncidentTableRow> }) => (
          <div className="flex min-w-0 items-center">
            <IncidentAssignee incident={row.original} />
          </div>
        ),
        enableSorting: false,
        filterFn: multiSelectFilterFn,
        // Rightmost filterable column: anchor the dropdown to the right edge so it
        // never flips placement (start↔end) on open/close.
        meta: liveColumnMeta(INCIDENT_COLUMNS.assignee, {
          filter: { options: assigneeOptions, placement: 'bottom-end' },
        }),
      },
      {
        id: 'actions',
        cell: ({ row }: { row: Row<IncidentTableRow> }) => (
          <div data-no-row-click className="pointer-events-auto flex items-center justify-end">
            {renderRowActions(row.original)}
          </div>
        ),
        enableSorting: false,
        meta: liveColumnMeta(INCIDENT_COLUMNS.actions),
      },
      {
        // The Mingo button, as `mingoActionFor` decides it (see `IncidentTableRow`
        // for why the cell reads nothing but the row).
        id: 'mingo',
        cell: ({ row }: { row: Row<IncidentTableRow> }) => {
          const { label, onClick, disabled, loading } = row.original.mingoAction;
          return (
            <div data-no-row-click className="pointer-events-auto flex items-center justify-end">
              <Button
                onClick={onClick}
                variant="outline"
                size="icon"
                leftIcon={
                  <MingoIcon
                    className="size-5"
                    eyesColor="var(--ods-flamingo-cyan-base)"
                    cornerColor="var(--ods-flamingo-cyan-base)"
                  />
                }
                aria-label={label}
                title={label}
                disabled={disabled}
                loading={loading}
                className="bg-ods-card"
              />
            </div>
          );
        },
        enableSorting: false,
        meta: liveColumnMeta(INCIDENT_COLUMNS.mingo),
      },
      {
        id: 'open',
        cell: ({ row }: { row: Row<IncidentTableRow> }) => (
          <div data-no-row-click className="pointer-events-auto flex items-center justify-end">
            <Button
              onClick={openInNewTab(routes.incidents.details(row.original.id))}
              variant="outline"
              size="icon"
              leftIcon={<ArrowRightUpIcon className="size-5" />}
              aria-label="Open in new tab"
              className="bg-ods-card"
            />
          </div>
        ),
        enableSorting: false,
        meta: liveColumnMeta(INCIDENT_COLUMNS.open),
      },
    ];
  }, [
    transition,
    transitionTable,
    isMutating,
    typeOptions,
    customerOptions,
    severityOptions,
    statusOptions,
    assigneeOptions,
    deviceScoped,
    statusLocked,
  ]);

  const filterGroups = [
    { id: INCIDENT_COLUMNS.incident.id, title: 'Category', options: typeOptions },
    ...(deviceScoped ? [] : [{ id: INCIDENT_COLUMNS.device.id, title: 'Customer', options: customerOptions }]),
    { id: INCIDENT_COLUMNS.severity.id, title: 'Severity', options: severityOptions },
    ...(statusLocked ? [] : [{ id: INCIDENT_COLUMNS.status.id, title: 'Status', options: statusOptions }]),
    { id: INCIDENT_COLUMNS.assignee.id, title: 'Assigned', options: assigneeOptions },
  ];

  const columnFilters = useMemo(
    () =>
      Object.entries(tableFilters)
        .filter(([, value]) => value && value.length > 0)
        .map(([id, value]) => ({ id, value })),
    [tableFilters],
  );

  const handleColumnFiltersChange = useCallback(
    // TanStack's updater signature: either the next state or a reducer over it.
    (updater: ColumnFilterState | ((prev: ColumnFilterState) => ColumnFilterState)) => {
      const next = typeof updater === 'function' ? updater(columnFilters) : updater;
      const nextFilters: Record<string, string[]> = {};
      for (const f of next) {
        nextFilters[f.id] = Array.isArray(f.value) ? (f.value as string[]) : [String(f.value)];
      }
      onFilterChange(nextFilters);
    },
    [columnFilters, onFilterChange],
  );

  const table = useDataTable<IncidentTableRow>({
    data: rows,
    columns,
    getRowId: (row: IncidentTableRow) => row.id,
    enableSorting: false,
    state: { columnFilters },
    onColumnFiltersChange: handleColumnFiltersChange,
  });

  const hasActiveFilters = Object.values(tableFilters).some(values => values.length > 0);
  const showEmptyState = !debouncedSearch && !hasActiveFilters && !isPending && rows.length === 0 && !hasAnyIncident;

  useEffect(() => {
    onEmptyChange(showEmptyState);
  }, [showEmptyState, onEmptyChange]);

  if (showEmptyState) {
    return emptyState;
  }

  return (
    <>
      {/* Dim (don't unmount) the stale rows while a deferred refetch is in
          flight — the subtle fade is the pending feedback. */}
      <div className={`transition-opacity duration-200 ${isPending ? 'opacity-60' : ''}`}>
        <DataTable table={table}>
          <DataTable.Header
            stickyHeader
            stickyHeaderOffset={stickyHeaderOffset}
            rightSlot={<DataTable.RowCount totalCount={filteredCount} />}
          />
          <DataTable.Body
            skeletonRows={PAGE_SIZE}
            emptyMessage={
              debouncedSearch
                ? `No incidents found matching "${debouncedSearch}". Try adjusting your search.`
                : 'No incidents found. Try adjusting your filters.'
            }
            rowClassName="mb-1"
            rowHref={(row: IncidentTableRow) => routes.incidents.details(row.id)}
          />
          <DataTable.InfiniteFooter
            hasNextPage={hasNext && !pageFailed}
            isFetchingNextPage={isLoadingNext}
            onLoadMore={fetchNextPage}
            skeletonRows={2}
          />
        </DataTable>
      </div>

      <FilterModal
        isOpen={mobileFilterOpen}
        onClose={onMobileFilterClose}
        filterGroups={filterGroups}
        onFilterChange={onFilterChange}
        currentFilters={tableFilters}
      />

      {/* Keyed on the target so the picker starts fresh for every incident. */}
      <SnoozeIncidentModal
        key={snoozeTarget?.id ?? 'closed'}
        open={snoozeTarget !== null}
        onOpenChange={open => !open && cancelSnooze()}
        onConfirm={confirmSnooze}
        isPending={isSnoozing}
      />
    </>
  );
}

// ----------------------------------------------------------------
// Loading skeleton
// ----------------------------------------------------------------

const EMPTY_ROWS: IncidentRow[] = [];

interface IncidentsTableSkeletonProps {
  layout: readonly TableSkeletonColumn[];
  stickyHeaderOffset: string;
}

function IncidentsTableSkeleton({ layout, stickyHeaderOffset }: IncidentsTableSkeletonProps) {
  // Same layout the live table renders, trailing action columns included, so
  // the loading header reserves the same widths and stays aligned.
  const columns = useMemo<ColumnDef<IncidentRow>[]>(() => skeletonColumnDefs<IncidentRow>(layout), [layout]);

  const table = useDataTable<IncidentRow>({
    data: EMPTY_ROWS,
    columns,
    getRowId: (row: IncidentRow) => row.id,
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
// Shared list + outer shells (URL state, layout)
// ----------------------------------------------------------------

/** The filter selections as they sit in the URL, whatever each shell names the params. */
interface IncidentSelections {
  type: string[];
  organizationId: string[];
  severity: string[];
  status: string[];
  assigneeId: string[];
}

interface IncidentsListProps {
  selections: IncidentSelections;
  search: string;
  onSearchChange: (value: string) => void;
  onSelectionsChange: (selections: IncidentSelections) => void;
  machineId?: string;
  /** The statuses the list covers (see `IncidentsTableContent`) — a module constant: the filter memo keys on it. */
  statuses: readonly InsightStatus[];
  /** The statuses listed while none is chosen; all of `statuses` when omitted. A module constant too. */
  defaultStatuses?: readonly InsightStatus[];
  /** The table's layout while it loads — the same one the live columns follow. */
  skeletonColumns: readonly TableSkeletonColumn[];
  refreshKey?: number;
  emptyState: ReactNode;
}

/** Toolbar + table over URL state the caller owns — what the page tabs and the device tab share. */
function IncidentsList({
  selections,
  search,
  onSearchChange,
  onSelectionsChange,
  machineId,
  statuses,
  defaultStatuses = statuses,
  skeletonColumns,
  refreshKey = 0,
  emptyState,
}: IncidentsListProps) {
  // Local search input keeps typing responsive; the shared hook debounces it to
  // the URL param and guards the back/forward sync-down against clobbering typing.
  const {
    search: searchInput,
    setSearch: setSearchInput,
    debouncedSearch,
  } = useSearchParam(search, onSearchChange, 300);

  const [isEmpty, setIsEmpty] = useState(false);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const { toolbarRef, containerStyle, stickyHeaderOffset } = useStickyToolbar();

  const deviceScoped = machineId !== undefined;

  // URL params are untyped strings — keep only real enum members (and, for
  // status, only the list's own; none on a single-status tab, which has no
  // control to clear one), and hand the SAME narrowed arrays to the server
  // filter and to the table's column state, so a stray `?status=BOGUS` cannot
  // empty the table client-side. With no status chosen the list shows
  // `defaultStatuses`.
  // One memo for both: `useDeferredQuery` compares `backendFilters` by identity.
  // The deps are the arrays, not `selections`, which the caller rebuilds every render.
  const { type, organizationId, severity, status, assigneeId } = selections;
  const { backendFilters, tableFilters } = useMemo(() => {
    const types = enumMembers(type, InsightType);
    const severities = enumMembers(severity, InsightSeverity);
    const chosenStatuses =
      statuses.length > 1 ? enumMembers(status, InsightStatus).filter(value => statuses.includes(value)) : [];
    const filter: InsightFilter = {
      statuses: chosenStatuses.length > 0 ? chosenStatuses : [...defaultStatuses],
      ...(types.length > 0 && { types }),
      ...(severities.length > 0 && { severities }),
      ...(organizationId.length > 0 && { organizationIds: organizationId }),
      ...(assigneeId.length > 0 && { assigneeIds: assigneeId }),
      ...(machineId !== undefined && { machineIds: [machineId] }),
    };
    return {
      backendFilters: filter,
      tableFilters: { type: types, organizationId, severity: severities, status: chosenStatuses, assigneeId },
    };
  }, [type, organizationId, severity, status, assigneeId, machineId, statuses, defaultStatuses]);

  // Deferred query variables: on a filter/search interaction the table keeps
  // rendering the current rows while the refetch is in flight, instead of
  // dropping to the Suspense skeleton. The dropdown state (`tableFilters`) stays
  // live so the checkboxes respond instantly.
  const { deferredFilters, deferredSearch, isPending } = useDeferredQuery(backendFilters, debouncedSearch);

  const handleFilterChange = (columnFilters: Record<string, string[]>) => {
    onSelectionsChange({
      type: columnFilters.type || [],
      organizationId: columnFilters.organizationId || [],
      severity: columnFilters.severity || [],
      status: columnFilters.status || [],
      assigneeId: columnFilters.assigneeId || [],
    });
    // In the device tab the top of `main` is the device header, above the filter just changed.
    if (!deviceScoped) {
      document.querySelector('main')?.scrollTo({ top: 0, behavior: 'instant' });
    }
  };

  return (
    <div className="flex flex-col" style={containerStyle}>
      {!isEmpty && (
        <div
          ref={toolbarRef}
          className="sticky top-0 z-20 -mx-[var(--spacing-system-l)] -mt-[var(--spacing-system-l)] flex gap-[var(--spacing-system-xs)] bg-ods-bg px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)] pt-[var(--spacing-system-l)]"
        >
          <Input
            placeholder="Search for Incidents"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            startAdornment={<SearchIcon className="size-4 md:size-6" />}
          />
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

      <Suspense fallback={<IncidentsTableSkeleton layout={skeletonColumns} stickyHeaderOffset={stickyHeaderOffset} />}>
        <IncidentsTableContent
          backendFilters={deferredFilters}
          debouncedSearch={deferredSearch}
          tableFilters={tableFilters}
          isPending={isPending}
          onFilterChange={handleFilterChange}
          onEmptyChange={setIsEmpty}
          mobileFilterOpen={mobileFilterOpen}
          onMobileFilterClose={() => setMobileFilterOpen(false)}
          stickyHeaderOffset={stickyHeaderOffset}
          deviceScoped={deviceScoped}
          statuses={statuses}
          refreshKey={refreshKey}
          emptyState={emptyState}
        />
      </Suspense>
    </div>
  );
}

/** The Incidents page's filter params — see the page for why it declares them too. */
export const INCIDENT_FILTER_PARAMS = defineParamSchema({
  search: { type: 'string', default: '' },
  type: { type: 'array', default: [] },
  organizationId: { type: 'array', default: [] },
  severity: { type: 'array', default: [] },
  status: { type: 'array', default: [] },
  assigneeId: { type: 'array', default: [] },
});

/** Every filter param at its default — keyed to the schema, so a param missing here fails tsc. */
export const NO_INCIDENT_FILTERS = {
  search: '',
  type: [],
  organizationId: [],
  severity: [],
  status: [],
  assigneeId: [],
} satisfies Record<keyof typeof INCIDENT_FILTER_PARAMS, unknown>;

/** One tab of the Incidents page. It owns the query string's filter params, unprefixed. */
export function IncidentsTable({ tab }: { tab: IncidentsTab }) {
  const { toast } = useToast();
  const view = INCIDENT_TAB_VIEWS[tab];
  const EmptyIcon = view.icon;
  const { params, setParam, setParams } = useApiParams(INCIDENT_FILTER_PARAMS);

  const [confirmArchive, setConfirmArchive] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [commitArchiveResolved, isArchiving] = useMutation<ArchiveResolvedInsightsMutationType>(
    archiveResolvedInsightsMutation,
  );

  const archiveResolved = () => {
    commitArchiveResolved({
      variables: {},
      onCompleted: ({ archiveResolvedInsights: count }) => {
        setConfirmArchive(false);
        // The sweep updates no record the store can see — refetch the list and its counts.
        setRefreshKey(key => key + 1);
        toast({
          title: count > 0 ? 'Resolved incidents archived' : 'Nothing to archive',
          description:
            count > 0
              ? `${pluralize(count, 'incident')} ${count === 1 ? 'was' : 'were'} moved to Archived Incidents.`
              : 'There are no resolved incidents.',
          variant: count > 0 ? 'success' : 'default',
        });
      },
      onError: error => {
        toast({
          title: 'Error',
          description: getRelayErrorMessage(error, 'Failed to archive resolved incidents'),
          variant: 'destructive',
        });
      },
    });
  };

  return (
    <PageLayout
      title={view.title}
      actions={view.archiveResolved ? [archiveResolvedAction(() => setConfirmArchive(true))] : undefined}
      actionsVariant="icon-buttons"
      className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
    >
      <IncidentsList
        selections={params}
        search={params.search}
        onSearchChange={value => setParam('search', value)}
        onSelectionsChange={setParams}
        statuses={view.statuses}
        skeletonColumns={view.columns}
        refreshKey={refreshKey}
        emptyState={<EmptyState icon={<EmptyIcon />} title={view.empty.title} description={view.empty.description} />}
      />
      <ConfirmDialog
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        title="Archive Resolved Incidents"
        description="Every resolved incident moves to Archived Incidents — not only the ones on screen. You can unarchive any of them from there."
        confirmLabel="Archive Resolved"
        cancelLabel="Close"
        isPending={isArchiving}
        onConfirm={archiveResolved}
      />
    </PageLayout>
  );
}

// The device tab has no Customer filter; a stable empty list keeps the filter memo quiet.
const NO_ORGANIZATIONS: string[] = [];

interface DeviceIncidentsTableProps {
  /** Raw `Machine.machineId` — what `InsightFilter.machineIds` takes. */
  machineId: string;
  emptyState: ReactNode;
}

/**
 * One device's incidents, for the device page's Incidents tab. Its URL params
 * carry an `incidents` prefix: they share the query string with the device
 * page's own (`id`, `tab`) and with the other tabs' lists.
 */
export function DeviceIncidentsTable({ machineId, emptyState }: DeviceIncidentsTableProps) {
  const { params, setParam, setParams } = useApiParams({
    incidentsSearch: { type: 'string', default: '' },
    incidentsType: { type: 'array', default: [] },
    incidentsSeverity: { type: 'array', default: [] },
    incidentsStatus: { type: 'array', default: [] },
    incidentsAssignee: { type: 'array', default: [] },
  });

  return (
    <IncidentsList
      selections={{
        type: params.incidentsType,
        organizationId: NO_ORGANIZATIONS,
        severity: params.incidentsSeverity,
        status: params.incidentsStatus,
        assigneeId: params.incidentsAssignee,
      }}
      search={params.incidentsSearch}
      onSearchChange={value => setParam('incidentsSearch', value)}
      onSelectionsChange={selections =>
        setParams({
          incidentsType: selections.type,
          incidentsSeverity: selections.severity,
          incidentsStatus: selections.status,
          incidentsAssignee: selections.assigneeId,
        })
      }
      machineId={machineId}
      statuses={ALL_INCIDENT_STATUSES}
      defaultStatuses={WORKING_SET_STATUSES}
      skeletonColumns={DEVICE_INCIDENTS_TABLE_COLUMNS}
      emptyState={emptyState}
    />
  );
}
