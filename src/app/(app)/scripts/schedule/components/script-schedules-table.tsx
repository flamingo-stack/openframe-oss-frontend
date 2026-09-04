'use client';

import { OSTypeBadgeGroup } from '@flamingo-stack/openframe-frontend-core/components';
import {
  ArrowRightUpIcon,
  BoxArchiveIcon,
  Filter02Icon,
  HourglassClockIcon,
  InboxArrowUpIcon,
  LaptopIcon,
  ListBulletIcon,
  PenEditIcon,
  PlusCircleIcon,
  RadarIcon,
  SearchIcon,
  TimerIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  ActionsMenuDropdown,
  type ActionsMenuGroup,
  Button,
  type ColumnDef,
  DataTable,
  type DataTableSortState,
  type DateFilterResult,
  type DateRange,
  FilterModal,
  Input,
  PageLayout,
  type Row,
  TruncateText,
  useDataTable,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useApiParams, useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useRouter } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { fetchQuery, useLazyLoadQuery, useMutation, usePaginationFragment, useRelayEnvironment } from 'react-relay';
import type { RecordSourceSelectorProxy } from 'relay-runtime';
import type { archiveScriptScheduleMutation as ArchiveScheduleMutationType } from '@/__generated__/archiveScriptScheduleMutation.graphql';
import type { scriptScheduleFiltersRefreshRelayQuery as ScheduleFiltersRefreshQueryType } from '@/__generated__/scriptScheduleFiltersRefreshRelayQuery.graphql';
import type { scriptSchedulesTableRelay_query$key as SchedulesFragmentKey } from '@/__generated__/scriptSchedulesTableRelay_query.graphql';
import type { scriptSchedulesTableRelayPaginationQuery as SchedulesPaginationQueryType } from '@/__generated__/scriptSchedulesTableRelayPaginationQuery.graphql';
import type {
  scriptSchedulesTableRelayQuery as SchedulesTableQueryType,
  ScriptScheduleFilterInput,
  SortInput,
} from '@/__generated__/scriptSchedulesTableRelayQuery.graphql';
import type { unarchiveScriptScheduleMutation as UnarchiveScheduleMutationType } from '@/__generated__/unarchiveScriptScheduleMutation.graphql';
import {
  DateColumnHeader,
  EmptyState,
  liveColumnMeta,
  onboardingGuideButton,
  skeletonColumnDefs,
  type TableDateFilter,
  useRetryKey,
} from '@/app/components/shared';
import { useDeferredQuery } from '@/app/hooks/use-deferred-query';
import { useQueuedParamsWrite } from '@/app/hooks/use-queued-params-write';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { useSearchParam } from '@/app/hooks/use-search-param';
import { useStickyToolbar } from '@/app/hooks/use-sticky-toolbar';
import { ScriptStatus } from '@/generated/schema-enums';
import { archiveScriptScheduleMutation } from '@/graphql/scripts/archive-script-schedule-mutation';
import { scriptScheduleFiltersRefreshRelayQuery } from '@/graphql/scripts/script-schedule-filters-refresh-relay';
import {
  scriptSchedulesTableRelayFragment,
  scriptSchedulesTableRelayQuery,
} from '@/graphql/scripts/script-schedules-table-relay';
import { unarchiveScriptScheduleMutation } from '@/graphql/scripts/unarchive-script-schedule-mutation';
import { dateRangeFromParams, dateRangeToInstantBounds, toDayParam } from '@/lib/date-filter-params';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import { openInNewTab } from '@/lib/open-in-new-tab';
import { routes } from '@/lib/routes';
import { multiSelectFilterFn } from '@/lib/table-filters';
import { SCHEDULE_COLUMNS, SCHEDULES_TABLE_COLUMNS } from '../../shared/components/scripts-table-columns';
import { facetToMappedOptions } from '../../shared/utils/facet-options';
import { platformsToEnums, platformsToIds } from '../../shared/utils/script-mappers';
import { formatScheduleStartAt, isEventTrigger, repeatToLabel } from '../utils/schedule-timing';
import { ArchiveScheduleModal } from './archive-schedule-modal';
import { RestoreScheduleModal } from './restore-schedule-modal';

const PAGE_SIZE = 20;

/**
 * The only values allowed to reach `SortInput.field` — everything else in the
 * URL falls back to the backend's own order.
 *
 * `repeat` is the REPEAT header's own toggle (id = backend field). `startAt` has
 * no header toggle: it is the direction inside the DATE & TIME calendar, which
 * writes the same `sortBy`/`sortDir` params so the two controls can't claim
 * conflicting orders at once. `scriptSchedules(sort:)` also accepts `name` and
 * `deviceCount`, which no control offers, so they stay unaccepted from the URL.
 */
const SORTABLE_COLUMN_IDS = ['repeat', 'startAt'] as const;

/** Backend sort field behind the DATE & TIME calendar (`ScriptSchedule.startAt`). */
const START_AT_SORT_FIELD = 'startAt';

/**
 * TanStack's column-filter state as `useDataTable` hands it back. Declared
 * structurally rather than imported: @tanstack/react-table is the core library's
 * dependency, not this app's, so importing it here would be an undeclared one.
 */
type ColumnFilterState = { id: string; value: unknown }[];

interface UiScheduleEntry {
  id: string;
  name: string;
  description: string;
  supportedPlatforms: string[];
  deviceCount: number;
  /** `DEVICE_ONLINE` schedules have no startAt/repeat at all — see `isEventTrigger`. */
  trigger: string;
  startAt: string | null;
  /** Which clock `startAt` is in — the Date & Time cell converts only a SERVER one. */
  timeReference: string;
  repeat: number | null;
}

// ----------------------------------------------------------------
// Inner content — Relay hooks, must live inside Suspense
// ----------------------------------------------------------------

interface SchedulesTableContentProps {
  backendFilters: ScriptScheduleFilterInput;
  debouncedSearch: string;
  /** Deferred sort — feeds the query (lags the live indicator during a refetch). */
  sort: SortInput | null;
  tableFilters: Record<string, string[]>;
  /** Live sort — drives the header indicator so it flips instantly on click. */
  sortState: DataTableSortState | null;
  onSortChange: (columnId: string) => void;
  /**
   * True while the deferred query variables lag the live filter/search state
   * (a refetch is in flight and the rows on screen are the previous result) —
   * guards the empty state so it never flashes on stale data.
   */
  isPending: boolean;
  onFilterChange: (filters: Record<string, string[]>) => void;
  /** First-run date sort + range, hosted by the DATE & TIME column header. */
  dateFilter: TableDateFilter;
  onEmptyChange: (isEmpty: boolean) => void;
  mobileFilterOpen: boolean;
  onMobileFilterClose: () => void;
  stickyHeaderOffset: string;
  archived: boolean;
}

function SchedulesTableContent({
  backendFilters,
  debouncedSearch,
  sort,
  tableFilters,
  sortState,
  onSortChange,
  isPending,
  onFilterChange,
  dateFilter,
  onEmptyChange,
  mobileFilterOpen,
  onMobileFilterClose,
  stickyHeaderOffset,
  archived,
}: SchedulesTableContentProps) {
  const { toast } = useToast();
  const environment = useRelayEnvironment();

  const [commitArchive, isArchiving] = useMutation<ArchiveScheduleMutationType>(archiveScriptScheduleMutation);
  const [commitUnarchive, isUnarchiving] = useMutation<UnarchiveScheduleMutationType>(unarchiveScriptScheduleMutation);

  // Schedule whose archive/restore is awaiting confirmation in the modal (null = closed).
  const [confirmTarget, setConfirmTarget] = useState<UiScheduleEntry | null>(null);

  // One round-trip per interaction: the filter facets (`scriptScheduleFilters`)
  // ride the list operation — see the query docstring.
  const retryKey = useRetryKey();
  const queryData = useLazyLoadQuery<SchedulesTableQueryType>(
    scriptSchedulesTableRelayQuery,
    {
      filter: backendFilters,
      search: debouncedSearch || null,
      sort,
      first: PAGE_SIZE,
      after: null,
    },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );

  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    SchedulesPaginationQueryType,
    SchedulesFragmentKey
  >(scriptSchedulesTableRelayFragment, queryData);

  // This list's connection record id — handed to archive/unarchive's `@deleteEdge`
  // so the mutated schedule's edge is removed from THIS list only.
  const connectionId = data.scriptSchedules?.__id;

  const transformedSchedules: UiScheduleEntry[] = useMemo(() => {
    const edges = data.scriptSchedules?.edges ?? [];
    // Defensive null-edge/node guard — mirrors scripts-table; `@deleteEdge`
    // keeps the record, so dangling edges aren't expected, but skipping them
    // keeps the map crash-proof.
    return edges.flatMap(edge => {
      const node = edge?.node;
      if (!node) return [];
      return [
        {
          id: node.id,
          name: node.name,
          description: node.description ?? '',
          supportedPlatforms: platformsToIds(node.supportedPlatforms),
          deviceCount: node.deviceCount,
          trigger: node.trigger,
          startAt: node.startAt ?? null,
          timeReference: node.timeReference,
          repeat: node.repeat ?? null,
        },
      ];
    });
  }, [data.scriptSchedules?.edges]);

  const fetchNextPage = useCallback(() => {
    if (hasNext && !isLoadingNext) {
      loadNext(PAGE_SIZE);
    }
  }, [hasNext, isLoadingNext, loadNext]);

  // Server-driven platform facet, mapped from the backend enum to the UI id the
  // column filter + `backendFilters` use (windows / darwin / linux).
  const platformOptions = useMemo(
    () => facetToMappedOptions(queryData.scriptScheduleFilters?.platforms, value => platformsToIds([value])[0]),
    [queryData.scriptScheduleFilters?.platforms],
  );

  const renderRowActions = useCallback(
    (schedule: UiScheduleEntry) => {
      const editHref = routes.scripts.schedules.edit(schedule.id);
      const devicesHref = routes.scripts.schedules.devices(schedule.id);
      const newTabIcon = <ArrowRightUpIcon className="h-5 w-5 text-ods-text-secondary" />;
      const mutating = isArchiving || isUnarchiving;

      // An archived schedule has exactly one thing that can be done to it, so it
      // gets a button rather than a menu — editing belongs to schedules that still
      // run, and a dropdown holding a single item is a click of pure ceremony.
      if (archived) {
        return (
          <Button
            onClick={() => setConfirmTarget(schedule)}
            variant="outline"
            size="icon"
            leftIcon={<InboxArrowUpIcon className="h-5 w-5" />}
            aria-label="Unarchive Schedule"
            disabled={mutating}
            className="bg-ods-card"
          />
        );
      }

      // Opens the confirmation modal only; the mutation runs on confirm.
      const groups: ActionsMenuGroup[] = [
        {
          items: [
            {
              id: 'edit-schedule',
              label: 'Edit Schedule',
              icon: <PenEditIcon className="h-6 w-6 text-ods-text-secondary" />,
              href: editHref,
              iconAction: {
                icon: newTabIcon,
                'aria-label': 'Open Edit Schedule in new tab',
                href: editHref,
                openInNewTab: true,
              },
            },
            {
              id: 'edit-devices',
              label: 'Edit Devices',
              icon: <LaptopIcon className="h-6 w-6 text-ods-text-secondary" />,
              href: devicesHref,
              iconAction: {
                icon: newTabIcon,
                'aria-label': 'Open Edit Devices in new tab',
                href: devicesHref,
                openInNewTab: true,
              },
            },
            {
              id: 'archive-schedule',
              label: 'Archive Schedule',
              icon: <BoxArchiveIcon className="h-6 w-6 text-ods-text-secondary" />,
              disabled: mutating,
              onClick: () => setConfirmTarget(schedule),
            },
          ],
        },
      ];

      return <ActionsMenuDropdown groups={groups} />;
    },
    [archived, isArchiving, isUnarchiving],
  );

  // Archiving/unarchiving changes the list's MEMBERSHIP, so the platform facet
  // may still offer values whose last schedule just left this scope. Re-fetch it
  // imperatively into the store (`fetchQuery(...).subscribe({})`); the list
  // itself is NOT refetched — `@deleteEdge` already updated it locally.
  const refreshFilterMeta = useCallback(() => {
    fetchQuery<ScheduleFiltersRefreshQueryType>(
      environment,
      scriptScheduleFiltersRefreshRelayQuery,
      { filter: backendFilters },
      { fetchPolicy: 'network-only' },
    ).subscribe({});
  }, [environment, backendFilters]);

  // Runs the archive/unarchive mutation for the schedule the confirm modal
  // targets. The `updater` invalidates the record so every OTHER cached
  // connection still holding its edge is marked stale and refetches on next
  // read — mirrors the scripts table's archive flow.
  const handleConfirmArchive = useCallback(() => {
    if (!confirmTarget) return;
    const { id, name } = confirmTarget;
    const connections = connectionId ? [connectionId] : [];
    const updater = (store: RecordSourceSelectorProxy) => store.get(id)?.invalidateRecord();
    const commit = archived ? commitUnarchive : commitArchive;
    commit({
      variables: { id, connections },
      updater,
      onCompleted: () => {
        toast(
          archived
            ? {
                title: 'Schedule unarchived',
                description: `"${name}" was moved back to Scripts Schedules.`,
                variant: 'success',
              }
            : {
                title: 'Schedule archived',
                description: `"${name}" was moved to Archived Schedules.`,
                variant: 'success',
              },
        );
        setConfirmTarget(null);
        refreshFilterMeta();
      },
      onError: error => {
        toast({
          title: 'Error',
          description: getRelayErrorMessage(error, `Failed to ${archived ? 'unarchive' : 'archive'} schedule`),
          variant: 'destructive',
        });
        setConfirmTarget(null);
      },
    });
  }, [confirmTarget, connectionId, archived, commitArchive, commitUnarchive, toast, refreshFilterMeta]);

  const columns = useMemo<ColumnDef<UiScheduleEntry>[]>(
    () => [
      {
        accessorKey: 'name',
        header: SCHEDULE_COLUMNS.name.header,
        cell: ({ row }: { row: Row<UiScheduleEntry> }) => (
          <div className="flex min-w-0 flex-col justify-center gap-1">
            <TruncateText>{row.original.name}</TruncateText>
            {row.original.description && (
              <TruncateText variant="h6" tone="secondary">
                {row.original.description}
              </TruncateText>
            )}
          </div>
        ),
        enableSorting: false,
        meta: liveColumnMeta(SCHEDULE_COLUMNS.name),
      },
      {
        accessorKey: 'supportedPlatforms',
        header: SCHEDULE_COLUMNS.supportedPlatforms.header,
        cell: ({ row }: { row: Row<UiScheduleEntry> }) => (
          <OSTypeBadgeGroup osTypes={row.original.supportedPlatforms} iconSize="w-4 h-4 md:w-6 md:h-6" />
        ),
        enableSorting: false,
        filterFn: multiSelectFilterFn,
        meta: liveColumnMeta(SCHEDULE_COLUMNS.supportedPlatforms, { filter: { options: platformOptions } }),
      },
      {
        id: 'dateTime',
        // The cell IS `startAt`, the field the calendar filters and orders by —
        // so the popover sits on this header rather than on a column of its own.
        header: () => <DateColumnHeader label={SCHEDULE_COLUMNS.dateTime.header} filter={dateFilter} />,
        cell: ({ row }: { row: Row<UiScheduleEntry> }) => {
          // Event-driven schedules have no date/time — name the trigger instead
          // of showing an em dash that reads as "not configured yet".
          if (isEventTrigger(row.original.trigger)) {
            return <TruncateText tone="secondary">Device Online</TruncateText>;
          }
          const { date, time } = formatScheduleStartAt(row.original.startAt, row.original.timeReference);
          if (!row.original.startAt) {
            return <span className="text-ods-text-secondary text-h4">—</span>;
          }
          return (
            <div className="flex min-w-0 flex-col justify-center gap-1">
              <TruncateText>{date}</TruncateText>
              <TruncateText variant="h6" tone="secondary">
                {time}
              </TruncateText>
            </div>
          );
        },
        enableSorting: false,
        meta: liveColumnMeta(SCHEDULE_COLUMNS.dateTime),
      },
      {
        id: 'repeat',
        header: SCHEDULE_COLUMNS.repeat.header,
        cell: ({ row }: { row: Row<UiScheduleEntry> }) =>
          isEventTrigger(row.original.trigger) ? (
            <span className="text-ods-text-secondary text-h4">—</span>
          ) : (
            <span className="text-ods-text-primary text-h4">{repeatToLabel(row.original.repeat)}</span>
          ),
        enableSorting: false,
        meta: liveColumnMeta(SCHEDULE_COLUMNS.repeat),
      },
      {
        accessorKey: 'deviceCount',
        header: SCHEDULE_COLUMNS.deviceCount.header,
        cell: ({ row }: { row: Row<UiScheduleEntry> }) => (
          <span className="text-ods-text-primary text-h4">{row.original.deviceCount}</span>
        ),
        enableSorting: false,
        meta: liveColumnMeta(SCHEDULE_COLUMNS.deviceCount),
      },
      {
        id: 'actions',
        cell: ({ row }: { row: Row<UiScheduleEntry> }) => (
          <div data-no-row-click className="pointer-events-auto flex items-center justify-end gap-2">
            {renderRowActions(row.original)}
          </div>
        ),
        enableSorting: false,
        meta: liveColumnMeta(SCHEDULE_COLUMNS.actions),
      },
      {
        id: 'open',
        cell: ({ row }: { row: Row<UiScheduleEntry> }) => (
          <div data-no-row-click className="pointer-events-auto flex items-center justify-end">
            <Button
              onClick={openInNewTab(routes.scripts.schedules.details(row.original.id))}
              variant="outline"
              size="icon"
              leftIcon={<ArrowRightUpIcon className="h-5 w-5" />}
              aria-label="Open in new tab"
              className="bg-ods-card"
            />
          </div>
        ),
        enableSorting: false,
        meta: liveColumnMeta(SCHEDULE_COLUMNS.open),
      },
    ],
    [renderRowActions, platformOptions, dateFilter],
  );

  const filterGroups = useMemo(
    () => [{ id: 'supportedPlatforms', title: 'OS', options: platformOptions }],
    [platformOptions],
  );

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

  const table = useDataTable<UiScheduleEntry>({
    data: transformedSchedules,
    columns,
    getRowId: (row: UiScheduleEntry) => row.id,
    enableSorting: false,
    state: { columnFilters },
    onColumnFiltersChange: handleColumnFiltersChange,
  });

  const scheduleRowHref = useCallback((schedule: UiScheduleEntry) => routes.scripts.schedules.details(schedule.id), []);

  // The date range narrows the list exactly like the OS funnel does, so it
  // counts as an active filter: an empty result then reads as "nothing matched"
  // instead of "no schedules yet" — and the placeholder, which replaces the
  // whole table, would take the calendar down with it and strand the user.
  const hasActiveFilters = Object.values(tableFilters).some(values => values.length > 0) || Boolean(dateFilter.range);
  const showEmptyState = !debouncedSearch && !hasActiveFilters && !isPending && transformedSchedules.length === 0;

  useEffect(() => {
    onEmptyChange(showEmptyState);
  }, [showEmptyState, onEmptyChange]);

  const guideButton = onboardingGuideButton('script-schedules');

  if (showEmptyState && archived) {
    return (
      <EmptyState
        icon={<BoxArchiveIcon />}
        title="No archived schedules"
        description="Schedules you archive will be moved here. They stay out of the main list but can be restored any time."
      />
    );
  }

  if (showEmptyState) {
    return (
      <EmptyState
        icon={<TimerIcon />}
        title="No scripts schedules yet"
        description="Scripts set to run automatically on a schedule (daily maintenance, weekly cleanups, monthly audits) will be displayed here."
        actions={[
          { icon: <HourglassClockIcon />, label: 'Run hourly, daily, weekly, or on custom cron' },
          { icon: <RadarIcon />, label: 'Target specific devices, Customers, or tags' },
          { icon: <ListBulletIcon />, label: 'View execution history and success rates' },
        ]}
        {...guideButton}
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
            rightSlot={<DataTable.RowCount />}
            sort={sortState}
            onSortChange={onSortChange}
          />
          <DataTable.Body
            skeletonRows={PAGE_SIZE}
            emptyMessage={
              debouncedSearch
                ? `No schedules found matching "${debouncedSearch}". Try adjusting your search.`
                : 'No schedules found. Try adjusting your filters or add a new schedule.'
            }
            rowClassName="mb-1"
            rowHref={scheduleRowHref}
          />
          <DataTable.InfiniteFooter
            hasNextPage={hasNext}
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
        // DATE & TIME is a `hideAt: 'md'` column, so below that breakpoint its
        // header calendar isn't on screen at all — this modal is where the same
        // sort + range lives, drafted alongside the OS funnel.
        dateFilter={{
          title: 'Date & Time',
          sort: dateFilter.sortDirection,
          range: dateFilter.range,
          onChange: dateFilter.onApply,
        }}
      />

      {archived ? (
        <RestoreScheduleModal
          open={confirmTarget !== null}
          onOpenChange={open => !open && setConfirmTarget(null)}
          onConfirm={handleConfirmArchive}
          isPending={isUnarchiving}
        />
      ) : (
        <ArchiveScheduleModal
          open={confirmTarget !== null}
          onOpenChange={open => !open && setConfirmTarget(null)}
          onConfirm={handleConfirmArchive}
          isPending={isArchiving}
        />
      )}
    </>
  );
}

// ----------------------------------------------------------------
// Loading skeleton
// ----------------------------------------------------------------

const EMPTY_ROWS: UiScheduleEntry[] = [];

function SchedulesTableSkeleton({ stickyHeaderOffset }: { stickyHeaderOffset: string }) {
  // Same layout the live table above renders, including the trailing action
  // columns — so the loading header reserves the same widths and stays aligned.
  const columns = useMemo<ColumnDef<UiScheduleEntry>[]>(
    () => skeletonColumnDefs<UiScheduleEntry>(SCHEDULES_TABLE_COLUMNS),
    [],
  );

  const table = useDataTable<UiScheduleEntry>({
    data: EMPTY_ROWS,
    columns,
    getRowId: (row: UiScheduleEntry) => row.id,
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

interface ScriptSchedulesTableProps {
  /** When true, lists archived schedules (status = ARCHIVED) with a back button instead of the header actions. */
  archived?: boolean;
}

export function ScriptSchedulesTable({ archived = false }: ScriptSchedulesTableProps = {}) {
  const router = useRouter();
  const handleBack = useSafeBack(routes.scripts.schedules.list);

  const { params, setParam, setParams } = useApiParams({
    search: { type: 'string', default: '' },
    supportedPlatforms: { type: 'array', default: [] },
    // Server-side sort: backend sort field ('repeat' from the REPEAT header,
    // 'startAt' from the DATE & TIME calendar) + direction. Empty sortBy =
    // backend default order (newest-first by _id).
    sortBy: { type: 'string', default: '' },
    sortDir: { type: 'string', default: 'desc' },
    // First-run date range (local `yyyy-MM-dd`, inclusive) — the DATE & TIME
    // calendar. Sent as `startAtFrom` / `startAtTo`.
    dateFrom: { type: 'string', default: '' },
    dateTo: { type: 'string', default: '' },
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

  // Applied first-run range, restored from the URL.
  const dateRange: DateRange | undefined = useMemo(
    () => dateRangeFromParams(params.dateFrom, params.dateTo),
    [params.dateFrom, params.dateTo],
  );

  const backendFilters: ScriptScheduleFilterInput = useMemo(() => {
    const supportedPlatforms = platformsToEnums(params.supportedPlatforms);
    // The picked days become inclusive UTC instants (local `00:00` → `23:59:59`),
    // so a day picked in the calendar is that whole day on the server.
    const bounds = dateRangeToInstantBounds(dateRange);
    // Default scriptSchedules() (null statuses) returns ACTIVE + ARCHIVED
    // together; scope each page explicitly so the archive lives on its own list.
    return {
      statuses: [archived ? ScriptStatus.ARCHIVED : ScriptStatus.ACTIVE],
      ...(supportedPlatforms.length > 0 && { supportedPlatforms }),
      ...(bounds.from && { startAtFrom: bounds.from }),
      ...(bounds.to && { startAtTo: bounds.to }),
    };
  }, [archived, params.supportedPlatforms, dateRange]);

  // `sortBy` arrives from the URL, so it is user input: a hand-edited or stale
  // link (`?sortBy=deviceCount` from before DEVICES lost its toggle) would
  // otherwise travel straight into `SortInput.field` and surface as a GraphQL
  // error inside the Suspense boundary, with no way back from the page itself.
  // Anything outside SORTABLE_COLUMN_IDS falls back to the backend's own order.
  const sortBy = (SORTABLE_COLUMN_IDS as readonly string[]).includes(params.sortBy) ? params.sortBy : '';

  // Backend SortInput for the query; null = no sort (backend default order).
  const sortInput = useMemo<SortInput | null>(
    () => (sortBy ? { field: sortBy, direction: params.sortDir === 'asc' ? 'ASC' : 'DESC' } : null),
    [sortBy, params.sortDir],
  );

  // Live descriptor the header renders its indicator from (flips instantly on
  // click). Only for the COLUMN toggles: `startAt` is the calendar's direction
  // and no column carries that id, so handing it over would have the header
  // hunting for a column that isn't there.
  const sortState = useMemo<DataTableSortState | null>(
    () => (sortBy && sortBy !== START_AT_SORT_FIELD ? { id: sortBy, desc: params.sortDir !== 'asc' } : null),
    [sortBy, params.sortDir],
  );

  // The calendar shows a direction only while it OWNS the sort; a list ordered
  // by REPEAT leaves it on its default rather than claiming that order too.
  const dateSortDirection: 'asc' | 'desc' = sortBy === START_AT_SORT_FIELD && params.sortDir === 'asc' ? 'asc' : 'desc';

  // The mobile FilterModal commits the funnels and the date section as two
  // callbacks in the same tick; the shared writer merges them into a single URL
  // write (sequential setParams calls each re-read the stale URL and clobber, so
  // the platform selection would be lost whenever a date is applied beside it).
  const queueParamsWrite = useQueuedParamsWrite(setParams);

  // Apply, and Reset (which fires with the selection cleared).
  const handleDateFilterApply = useCallback(
    (result: DateFilterResult) => {
      const dateFrom = result.range?.from ? toDayParam(result.range.from) : '';
      const dateTo = result.range?.to ? toDayParam(result.range.to) : '';
      // The calendar takes the sort when it has something to order by — a range,
      // or an explicit oldest-first. Cleared back to its defaults it gives the
      // sort up again, so Reset returns the list (and the URL) to the backend
      // order — but only if the calendar is what took it: a list sorted by
      // REPEAT keeps its own sort through all of this.
      const ownsSort = result.sort === 'asc' || Boolean(dateFrom || dateTo);
      const leavesOtherSortAlone = !ownsSort && sortBy !== START_AT_SORT_FIELD;
      queueParamsWrite({
        ...(leavesOtherSortAlone
          ? {}
          : // `sortDir: ''` — NOT `'desc'` — for the default direction, per the
            // note on `handleSortChange` below.
            { sortBy: ownsSort ? START_AT_SORT_FIELD : '', sortDir: result.sort === 'desc' ? '' : result.sort }),
        dateFrom,
        dateTo,
      });
    },
    [queueParamsWrite, sortBy],
  );

  const dateFilter: TableDateFilter = useMemo(
    () => ({ sortDirection: dateSortDirection, range: dateRange, onApply: handleDateFilterApply }),
    [dateSortDirection, dateRange, handleDateFilterApply],
  );

  // Filter + sort travel together as one deferred object so the query lags in
  // lockstep and `isPending` covers both; the LIVE params keep driving the
  // controls (checkboxes, header indicator) so they respond instantly.
  const queryVars = useMemo(() => ({ filter: backendFilters, sort: sortInput }), [backendFilters, sortInput]);
  const { deferredFilters: deferredVars, deferredSearch, isPending } = useDeferredQuery(queryVars, debouncedSearch);

  const tableFilters = useMemo(() => ({ supportedPlatforms: params.supportedPlatforms }), [params.supportedPlatforms]);

  const handleFilterChange = useCallback(
    (columnFilters: Record<string, string[]>) => {
      queueParamsWrite({ supportedPlatforms: columnFilters.supportedPlatforms || [] });
    },
    [queueParamsWrite],
  );

  // 3-state toggle owned by the consumer (per DataTable.Header contract):
  // unsorted → desc → asc → unsorted. `columnId` is the column's id, which
  // equals the backend sort field ('repeat').
  //
  // `sortDir: ''` — NOT `'desc'` — whenever the direction is the default one:
  // `useApiParams` drops a param from the URL only when the value is empty, it
  // never compares against the schema default. Writing `'desc'` would leave a
  // stale `?sortDir=desc` behind on an unsorted list. Reading it back still
  // yields `'desc'` (the schema default), so the state is identical.
  // Cycles against the CLAMPED value, so a bogus `?sortBy` in the URL behaves
  // like no sort at all rather than as an invisible first state to click past.
  const handleSortChange = useCallback(
    (columnId: string) => {
      if (sortBy !== columnId) {
        setParams({ sortBy: columnId, sortDir: '' });
      } else if (params.sortDir === 'desc') {
        setParams({ sortDir: 'asc' });
      } else {
        setParams({ sortBy: '', sortDir: '' });
      }
      document.querySelector('main')?.scrollTo({ top: 0, behavior: 'instant' });
    },
    [sortBy, params.sortDir, setParams],
  );

  const handleOpenArchive = useCallback(() => {
    router.push(routes.scripts.schedules.archived);
  }, [router]);

  const handleNewSchedule = useCallback(() => {
    router.push(routes.scripts.schedules.new);
  }, [router]);

  // Archived list has no header actions (back button only); the active list
  // shows Archive (→ archived page) + Add Schedule.
  const actions = useMemo(
    () =>
      archived
        ? []
        : [
            {
              label: 'Archive',
              variant: 'outline' as const,
              icon: <BoxArchiveIcon className="h-6 w-6 text-ods-text-secondary" />,
              onClick: handleOpenArchive,
            },
            {
              label: 'Add Schedule',
              variant: (isEmpty ? 'accent' : 'outline') as 'accent' | 'outline',
              icon: (
                <PlusCircleIcon size={24} className={isEmpty ? 'text-ods-text-on-accent' : 'text-ods-text-secondary'} />
              ),
              onClick: handleNewSchedule,
            },
          ],
    [archived, handleOpenArchive, handleNewSchedule, isEmpty],
  );

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
    <PageLayout
      title={archived ? 'Archived Schedules' : 'Scripts Schedules'}
      backButton={archived ? { label: 'Back', onClick: handleBack } : undefined}
      actions={actions.length > 0 ? actions : undefined}
      className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
    >
      <div className="flex flex-col" style={containerStyle}>
        {!isEmpty && (
          <div
            ref={toolbarRef}
            className="sticky top-0 z-20 -mx-[var(--spacing-system-l)] -mt-[var(--spacing-system-l)] flex items-center gap-[var(--spacing-system-m)] bg-ods-bg p-[var(--spacing-system-l)]"
          >
            <Input
              placeholder="Search for Schedule"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="flex-1"
              startAdornment={<SearchIcon className="h-4 w-4 md:h-6 md:w-6" />}
            />
            {mobileFilterButton}
          </div>
        )}

        <Suspense fallback={<SchedulesTableSkeleton stickyHeaderOffset={stickyHeaderOffset} />}>
          <SchedulesTableContent
            backendFilters={deferredVars.filter}
            debouncedSearch={deferredSearch}
            sort={deferredVars.sort}
            tableFilters={tableFilters}
            sortState={sortState}
            onSortChange={handleSortChange}
            isPending={isPending}
            onFilterChange={handleFilterChange}
            dateFilter={dateFilter}
            onEmptyChange={setIsEmpty}
            mobileFilterOpen={mobileFilterOpen}
            onMobileFilterClose={() => setMobileFilterOpen(false)}
            stickyHeaderOffset={stickyHeaderOffset}
            archived={archived}
          />
        </Suspense>
      </div>
    </PageLayout>
  );
}
