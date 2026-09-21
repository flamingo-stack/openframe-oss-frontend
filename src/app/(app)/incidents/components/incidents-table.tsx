'use client';

import { MingoIcon } from '@flamingo-stack/openframe-frontend-core/components/icons';
import {
  AlertTriangleIcon,
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
import { formatDistanceToNowStrict } from 'date-fns';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { fetchQuery, readInlineData, useLazyLoadQuery, usePaginationFragment, useRelayEnvironment } from 'react-relay';
import type { incidentFiltersRefreshRelayQuery as IncidentFiltersRefreshQueryType } from '@/__generated__/incidentFiltersRefreshRelayQuery.graphql';
import type { incidentsTableRelay_query$key as IncidentsFragmentKey } from '@/__generated__/incidentsTableRelay_query.graphql';
import type { incidentsTableRelayPaginationQuery as IncidentsPaginationQueryType } from '@/__generated__/incidentsTableRelayPaginationQuery.graphql';
import type {
  incidentsTableRelayQuery as IncidentsTableQueryType,
  InsightFilter,
} from '@/__generated__/incidentsTableRelayQuery.graphql';
import type { insightFacets_filters$key as InsightFacetsKey } from '@/__generated__/insightFacets_filters.graphql';
import { EmptyState, liveColumnMeta, skeletonColumnDefs, useRetryKey } from '@/app/components/shared';
import { renderDeviceTypeIcon } from '@/app/components/shared/device-type-icon';
import { useDeferredQuery } from '@/app/hooks/use-deferred-query';
import { useSearchParam } from '@/app/hooks/use-search-param';
import { useStickyToolbar } from '@/app/hooks/use-sticky-toolbar';
import { InsightSeverity, InsightStatus, InsightType } from '@/generated/schema-enums';
import { incidentFiltersRefreshRelayQuery } from '@/graphql/insights/incident-filters-refresh-relay';
import { incidentsTableRelayFragment, incidentsTableRelayQuery } from '@/graphql/insights/incidents-table-relay';
import { insightFacetsFragment } from '@/graphql/insights/insight-facets';
import { formatDateTime } from '@/lib/format-date';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import { openInNewTab } from '@/lib/open-in-new-tab';
import { routes } from '@/lib/routes';
import { multiSelectFilterFn } from '@/lib/table-filters';
import { type FacetEntry, type FacetOption, facetToSortedOptions } from '../../scripts/shared/utils/facet-options';
import { useFixWithMingo } from '../hooks/use-fix-with-mingo';
import { useIncidentTransitions } from '../hooks/use-incident-transitions';
import {
  enumMembers,
  INCIDENT_SEVERITY_LABELS,
  INCIDENT_STATUS_LABELS,
  INCIDENT_TYPE_LABELS,
  labelOf,
  WORKING_SET_STATUSES,
} from '../utils/incident-labels';
import { type IncidentRow, toIncidentRow, toTransitionTable } from '../utils/incident-transform';
import { IncidentSeverityTag, IncidentStatusTag } from './incident-tags';
import { INCIDENT_COLUMNS, INCIDENTS_TABLE_COLUMNS } from './incidents-table-columns';
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
    return formatDistanceToNowStrict(new Date(row.detectedAt));
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
}: IncidentsTableContentProps) {
  const { toast } = useToast();
  const environment = useRelayEnvironment();
  const { fixWithMingo, pendingId: mingoPendingId, canOpenMingo } = useFixWithMingo();

  // One round-trip per interaction: the filter facets (`insightFilters`) ride the
  // list operation — see the query docstring for the facet semantics.
  const retryKey = useRetryKey();
  const queryData = useLazyLoadQuery<IncidentsTableQueryType>(
    incidentsTableRelayQuery,
    {
      filter: backendFilters,
      search: debouncedSearch || null,
      first: PAGE_SIZE,
      after: null,
    },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );

  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    IncidentsPaginationQueryType,
    IncidentsFragmentKey
  >(incidentsTableRelayFragment, queryData);

  const rows: IncidentRow[] = (data.insights?.edges ?? []).flatMap(edge =>
    edge?.node ? [toIncidentRow(edge.node)] : [],
  );

  // A failed page must stop the footer: its sentinel stays in view, Relay
  // clears `isLoadingNext` on the error, and the observer would ask again at
  // once — hundreds of identical failing requests a second against a backend
  // that just said no. One toast, then the footer goes quiet. Recorded against
  // the variables it failed for: this component stays mounted across filter,
  // search and retry changes, and a new list gets its own footer. Compared by
  // identity on purpose — `backendFilters` is memoized upstream and only
  // changes with the URL params, so a re-render cannot revive the footer.
  const [failedPage, setFailedPage] = useState<{ filter: InsightFilter; search: string; retryKey: number } | null>(
    null,
  );
  const pageFailed =
    failedPage !== null &&
    failedPage.filter === backendFilters &&
    failedPage.search === debouncedSearch &&
    failedPage.retryKey === retryKey;
  const fetchNextPage = () => {
    if (!hasNext || isLoadingNext || pageFailed) return;
    loadNext(PAGE_SIZE, {
      onComplete: error => {
        if (!error) return;
        setFailedPage({ filter: backendFilters, search: debouncedSearch, retryKey });
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
  const statusOptions = enumFacetOptions(facets.statuses, INCIDENT_STATUS_LABELS);
  const customerOptions = facetToSortedOptions(facets.organizationIds);
  const filteredCount = facets.filteredCount ?? undefined;
  // The status facet is narrowed by every filter EXCEPT status, so under the
  // working-set default it still counts ARCHIVED — a tenant whose incidents are
  // all filed away has "no rows" but is not empty, and keeps the filters.
  const hasAnyIncident = facets.statuses.some(option => option.count > 0);

  // A transition rewrites one record, but the status counts (and the total) it
  // was aggregated into stay as fetched — refetch the facets imperatively into
  // the same store records the dropdowns read from. The list itself is not
  // refetched: the mutation payload already updated the row, which stays in
  // place even when its new status is outside the active filter until the next
  // filter interaction or reload.
  const refreshFilterMeta = () => {
    fetchQuery<IncidentFiltersRefreshQueryType>(
      environment,
      incidentFiltersRefreshRelayQuery,
      { filter: backendFilters, search: debouncedSearch || null },
      { fetchPolicy: 'network-only' },
    ).subscribe({});
  };

  const { transition, snoozeTarget, cancelSnooze, confirmSnooze, isMutating, isSnoozing } =
    useIncidentTransitions(refreshFilterMeta);
  const transitionTable = toTransitionTable(queryData);

  const columns = useMemo<ColumnDef<IncidentRow>[]>(() => {
    const renderRowActions = (row: IncidentRow) => {
      const items = transitionMenuItems(row, transitionTable, transition, isMutating);
      return items.length > 0 ? <ActionsMenuDropdown groups={[{ items }]} /> : null;
    };
    return [
      {
        accessorKey: 'type',
        header: INCIDENT_COLUMNS.incident.header,
        cell: ({ row }: { row: Row<IncidentRow> }) => (
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
      {
        // The Device column filters by CUSTOMER (its second line): the API has no
        // device facet, and a customer narrows the fleet the way a technician does.
        accessorKey: 'organizationId',
        header: INCIDENT_COLUMNS.device.header,
        cell: ({ row }: { row: Row<IncidentRow> }) => (
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
      },
      {
        accessorKey: 'severity',
        header: INCIDENT_COLUMNS.severity.header,
        cell: ({ row }: { row: Row<IncidentRow> }) => <IncidentSeverityTag severity={row.original.severity} />,
        enableSorting: false,
        filterFn: multiSelectFilterFn,
        meta: liveColumnMeta(INCIDENT_COLUMNS.severity, { filter: { options: severityOptions } }),
      },
      {
        accessorKey: 'status',
        header: INCIDENT_COLUMNS.status.header,
        cell: ({ row }: { row: Row<IncidentRow> }) => (
          <div className="flex min-w-0 flex-col items-start justify-center gap-[var(--spacing-system-xxs)]">
            <IncidentStatusTag status={row.original.status} />
            <TruncateText variant="h6" tone="secondary">
              {statusTime(row.original)}
            </TruncateText>
          </div>
        ),
        enableSorting: false,
        filterFn: multiSelectFilterFn,
        // Rightmost filterable column: anchor the dropdown to the right edge so it
        // never flips placement (start↔end) on open/close.
        meta: liveColumnMeta(INCIDENT_COLUMNS.status, {
          filter: { options: statusOptions, placement: 'bottom-end' },
        }),
      },
      {
        id: 'actions',
        cell: ({ row }: { row: Row<IncidentRow> }) => (
          <div data-no-row-click className="pointer-events-auto flex items-center justify-end">
            {renderRowActions(row.original)}
          </div>
        ),
        enableSorting: false,
        meta: liveColumnMeta(INCIDENT_COLUMNS.actions),
      },
      {
        // "Fix with Mingo": fetches the server's prompt for the incident and
        // opens the drawer on a fresh chat with it in the composer — nothing
        // sent. Disabled while no drawer is mounted (locked workspace).
        id: 'mingo',
        cell: ({ row }: { row: Row<IncidentRow> }) => (
          <div data-no-row-click className="pointer-events-auto flex items-center justify-end">
            <Button
              onClick={() => fixWithMingo(row.original)}
              variant="outline"
              size="icon"
              leftIcon={
                <MingoIcon
                  className="size-5"
                  eyesColor="var(--ods-flamingo-cyan-base)"
                  cornerColor="var(--ods-flamingo-cyan-base)"
                />
              }
              aria-label="Fix with Mingo"
              disabled={!canOpenMingo || mingoPendingId !== null}
              loading={mingoPendingId === row.original.id}
              className="bg-ods-card"
            />
          </div>
        ),
        enableSorting: false,
        meta: liveColumnMeta(INCIDENT_COLUMNS.mingo),
      },
      {
        id: 'open',
        cell: ({ row }: { row: Row<IncidentRow> }) => (
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
    canOpenMingo,
    fixWithMingo,
    mingoPendingId,
    typeOptions,
    customerOptions,
    severityOptions,
    statusOptions,
  ]);

  const filterGroups = [
    { id: INCIDENT_COLUMNS.incident.id, title: 'Category', options: typeOptions },
    { id: INCIDENT_COLUMNS.device.id, title: 'Customer', options: customerOptions },
    { id: INCIDENT_COLUMNS.severity.id, title: 'Severity', options: severityOptions },
    { id: INCIDENT_COLUMNS.status.id, title: 'Status', options: statusOptions },
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

  const table = useDataTable<IncidentRow>({
    data: rows,
    columns,
    getRowId: (row: IncidentRow) => row.id,
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
    return (
      <EmptyState
        icon={<AlertTriangleIcon />}
        title="No incidents detected"
        description="Your monitored devices are all clear"
      />
    );
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
            rowHref={(row: IncidentRow) => routes.incidents.details(row.id)}
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

function IncidentsTableSkeleton({ stickyHeaderOffset }: { stickyHeaderOffset: string }) {
  // Same layout the live table renders, trailing action columns included, so
  // the loading header reserves the same widths and stays aligned.
  const columns = useMemo<ColumnDef<IncidentRow>[]>(() => skeletonColumnDefs<IncidentRow>(INCIDENTS_TABLE_COLUMNS), []);

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
// Outer shell — layout + URL state + Suspense boundary
// ----------------------------------------------------------------

export function IncidentsTable() {
  const { params, setParam, setParams } = useApiParams({
    search: { type: 'string', default: '' },
    type: { type: 'array', default: [] },
    organizationId: { type: 'array', default: [] },
    severity: { type: 'array', default: [] },
    status: { type: 'array', default: [] },
  });

  // Local search input keeps typing responsive; the shared hook debounces it to
  // the URL param and guards the back/forward sync-down against clobbering typing.
  const {
    search: searchInput,
    setSearch: setSearchInput,
    debouncedSearch,
  } = useSearchParam(params.search, value => setParam('search', value), 300);

  const [isEmpty, setIsEmpty] = useState(false);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const { toolbarRef, containerStyle, stickyHeaderOffset } = useStickyToolbar();

  // URL params are untyped strings — keep only real enum members, and hand the
  // SAME narrowed arrays to the server filter and to the table's column state,
  // so a stray `?status=BOGUS` cannot empty the table client-side. With no
  // status chosen the list is the working set: everything but ARCHIVED.
  // One memo for both: `useDeferredQuery` compares `backendFilters` by identity.
  const { backendFilters, tableFilters } = useMemo(() => {
    const types = enumMembers(params.type, InsightType);
    const severities = enumMembers(params.severity, InsightSeverity);
    const statuses = enumMembers(params.status, InsightStatus);
    const filter: InsightFilter = {
      statuses: statuses.length > 0 ? statuses : [...WORKING_SET_STATUSES],
      ...(types.length > 0 && { types }),
      ...(severities.length > 0 && { severities }),
      ...(params.organizationId.length > 0 && { organizationIds: params.organizationId }),
    };
    return {
      backendFilters: filter,
      tableFilters: { type: types, organizationId: params.organizationId, severity: severities, status: statuses },
    };
  }, [params.type, params.severity, params.status, params.organizationId]);

  // Deferred query variables: on a filter/search interaction the table keeps
  // rendering the current rows while the refetch is in flight, instead of
  // dropping to the Suspense skeleton. The dropdown state (`tableFilters`) stays
  // live so the checkboxes respond instantly.
  const { deferredFilters, deferredSearch, isPending } = useDeferredQuery(backendFilters, debouncedSearch);

  const handleFilterChange = (columnFilters: Record<string, string[]>) => {
    setParams({
      type: columnFilters.type || [],
      organizationId: columnFilters.organizationId || [],
      severity: columnFilters.severity || [],
      status: columnFilters.status || [],
    });
    document.querySelector('main')?.scrollTo({ top: 0, behavior: 'instant' });
  };

  const mobileFilterButton = (
    <Button
      variant="outline"
      size="icon"
      className="md:hidden"
      onClick={() => setMobileFilterOpen(true)}
      aria-label="Open filters"
      leftIcon={<Filter02Icon className="text-ods-text-primary" />}
    />
  );

  return (
    <PageLayout title="Incidents" className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]">
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
            {mobileFilterButton}
          </div>
        )}

        <Suspense fallback={<IncidentsTableSkeleton stickyHeaderOffset={stickyHeaderOffset} />}>
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
          />
        </Suspense>
      </div>
    </PageLayout>
  );
}
