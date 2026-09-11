'use client';

import { Tag } from '@flamingo-stack/openframe-frontend-core';
import {
  ArrowRightUpIcon,
  ComputerMouseIcon,
  Filter02Icon,
  TrashIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Button,
  type ColumnDef,
  type ColumnFiltersState,
  DataTable,
  type DateFilterResult,
  type DateRange,
  FilterModal,
  type Row,
  SearchInput,
  type SortDirection,
  type SortingState,
  SquareAvatar,
  TruncateText,
  useDataTable,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useDebounce } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { ConfirmDialog } from '@/app/components/shared/confirm-dialog';
import { DateColumnHeader, type TableDateFilter } from '@/app/components/shared/date-column-header';
import { liveColumnMeta } from '@/app/components/shared/table-column-layout';
import { useStickyToolbar } from '@/app/hooks/use-sticky-toolbar';
import { dateRangeToInstantBounds } from '@/lib/date-filter-params';
import { formatDate, formatDateTime, formatTime } from '@/lib/format-date';
import { routes } from '@/lib/routes';
import { multiSelectFilterFn } from '@/lib/table-filters';
import { useDeleteSessionRecording, useSessionRecordings } from '../../hooks/use-session-recordings';
import type { Device } from '../../types/device.types';
import type { RecordingSummary } from '../../types/session-recording';
import { formatBytes, formatDurationMs } from '../remote-sessions/format';
import { REMOTE_SESSION_COLUMNS } from './device-tab-columns';
import { TabEmptyState } from './tab-empty-state';

interface RemoteSessionsTabProps {
  device: Device | null;
}

const EMPTY_RECORDINGS: RecordingSummary[] = [];
const EMPTY_COLUMN_FILTERS: ColumnFiltersState = [];

/** Newest session first, like every history list on the device page. */
const DEFAULT_SORTING: SortingState = [{ id: 'session', desc: true }];

function employeeInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('');
}

/** Recorded remote sessions of this device (Figma 744-40363), on the mock service until CU-86akc3c5q ships. */
export function RemoteSessionsTab({ device }: RemoteSessionsTabProps) {
  const router = useRouter();
  const deviceId = device?.machineId ?? null;
  const { data, isLoading } = useSessionRecordings(deviceId);
  const deleteRecording = useDeleteSessionRecording(deviceId ?? '');

  const [sorting, setSorting] = useState<SortingState>(DEFAULT_SORTING);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(EMPTY_COLUMN_FILTERS);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [deleteTarget, setDeleteTarget] = useState<RecordingSummary | null>(null);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const { toolbarRef, containerStyle, stickyHeaderOffset } = useStickyToolbar();

  const allRecordings = data ?? EMPTY_RECORDINGS;
  const recordings = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    // The picked calendar days become inclusive local-day instants, the same
    // bounds the server-side date filters send (`dateRangeToInstantBounds`).
    const bounds = dateRangeToInstantBounds(dateRange);
    const fromMs = bounds.from ? Date.parse(bounds.from) : null;
    const toMs = bounds.to ? Date.parse(bounds.to) : null;

    return allRecordings.filter(recording => {
      if (fromMs !== null || toMs !== null) {
        const startedMs = Date.parse(recording.startedAt);
        if (fromMs !== null && startedMs < fromMs) return false;
        if (toMs !== null && startedMs > toMs) return false;
      }
      if (!query) return true;
      return [recording.employee.name, recording.employee.role ?? '', formatDateTime(recording.startedAt)]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [allRecordings, dateRange, debouncedSearch]);

  // The SESSION header's calendar popover (Figma 744-40363, same control as the
  // Logs date column): session-date sort + range. The sort half writes into the
  // shared `sorting` state, so it and the DURATION header toggle stay mutually
  // exclusive like any two sorted columns.
  const sessionSortDirection: 'asc' | 'desc' =
    sorting[0]?.id === REMOTE_SESSION_COLUMNS.session.id && !sorting[0].desc ? 'asc' : 'desc';
  const handleDateFilterApply = useCallback((result: DateFilterResult) => {
    setDateRange(result.range);
    setSorting([{ id: REMOTE_SESSION_COLUMNS.session.id, desc: result.sort === 'desc' }]);
  }, []);
  const dateFilter: TableDateFilter = useMemo(
    () => ({ sortDirection: sessionSortDirection, range: dateRange, onApply: handleDateFilterApply }),
    [sessionSortDirection, dateRange, handleDateFilterApply],
  );

  // EMPLOYEE header funnel options - the technicians present in this device's
  // list (the mock has no employee ids, so the name doubles as the value; the
  // filterFn compares it against the employee cell's accessor value).
  const employeeOptions = useMemo(() => {
    const names = [...new Set(allRecordings.map(recording => recording.employee.name))].sort();
    return names.map(name => ({ id: name, value: name, label: name }));
  }, [allRecordings]);

  // The mobile FilterModal (Figma 758-46869) and the desktop header funnel are
  // two views over the SAME columnFilters state, bridged between TanStack's
  // array shape and the modal's `Record<columnId, selectedIds>` shape.
  const employeeFilterId = REMOTE_SESSION_COLUMNS.employee.id;
  const modalFilterGroups = useMemo(
    () => [{ id: employeeFilterId, title: 'Employee', options: employeeOptions }],
    [employeeFilterId, employeeOptions],
  );
  const modalFilters = useMemo(() => {
    const selected = columnFilters.find(filter => filter.id === employeeFilterId)?.value;
    return Array.isArray(selected) && selected.length > 0 ? { [employeeFilterId]: selected as string[] } : {};
  }, [columnFilters, employeeFilterId]);
  const handleModalFilterChange = useCallback(
    (filters: Record<string, string[]>) => {
      const selected = filters[employeeFilterId] ?? [];
      setColumnFilters(selected.length > 0 ? [{ id: employeeFilterId, value: selected }] : []);
    },
    [employeeFilterId],
  );

  // Everything sortable on the desktop header is sortable in the modal too -
  // the same `sorting` state, so a direction picked here lights the header
  // arrow when the viewport grows (pattern from `invoices-history.tsx`).
  // Session is NOT in this list: its sort rides the date section below, the
  // same way the desktop header keeps it inside the calendar popover.
  const modalSortConfig = useMemo(
    () => ({
      columns: [{ key: REMOTE_SESSION_COLUMNS.duration.id, label: 'Duration' }],
      sortBy: sorting[0]?.id,
      sortDirection: sorting[0] ? ((sorting[0].desc ? 'desc' : 'asc') as SortDirection) : undefined,
    }),
    [sorting],
  );
  const handleModalSort = useCallback((columnId: string, direction: SortDirection) => {
    setSorting([{ id: columnId, desc: direction === 'desc' }]);
  }, []);
  const handleModalSortClear = useCallback(() => setSorting([]), []);

  const columns = useMemo<ColumnDef<RecordingSummary>[]>(
    () => [
      {
        id: REMOTE_SESSION_COLUMNS.session.id,
        header: () => <DateColumnHeader label={REMOTE_SESSION_COLUMNS.session.header} filter={dateFilter} />,
        // ISO timestamps sort correctly as strings.
        accessorFn: (row: RecordingSummary) => row.startedAt,
        cell: ({ row }: { row: Row<RecordingSummary> }) => (
          <div className="flex min-w-0 flex-col justify-center gap-[var(--spacing-system-xxs)]">
            <div className="flex min-w-0 items-center gap-[var(--spacing-system-xsf)]">
              <TruncateText>{formatDate(row.original.startedAt)}</TruncateText>
              {row.original.processing && <Tag label="PROCESSING" variant="warning" className="shrink-0" />}
            </div>
            <TruncateText variant="h6" tone="secondary">
              {formatTime(row.original.startedAt)}
            </TruncateText>
          </div>
        ),
        enableSorting: true,
        meta: liveColumnMeta(REMOTE_SESSION_COLUMNS.session),
      },
      {
        id: REMOTE_SESSION_COLUMNS.employee.id,
        header: REMOTE_SESSION_COLUMNS.employee.header,
        accessorFn: (row: RecordingSummary) => row.employee.name,
        cell: ({ row }: { row: Row<RecordingSummary> }) => {
          const { name, role, avatarUrl } = row.original.employee;
          return (
            <div className="flex min-w-0 items-center gap-[var(--spacing-system-xsf)]">
              <SquareAvatar
                variant="round"
                size="md"
                src={avatarUrl}
                fallback={employeeInitials(name)}
                alt={name}
                initialsClassName="text-ods-text-secondary"
              />
              <div className="flex min-w-0 flex-col justify-center">
                <TruncateText>{name}</TruncateText>
                {role && (
                  <TruncateText variant="h6" tone="secondary">
                    {role}
                  </TruncateText>
                )}
              </div>
            </div>
          );
        },
        enableSorting: false,
        filterFn: multiSelectFilterFn,
        meta: liveColumnMeta(REMOTE_SESSION_COLUMNS.employee, { filter: { options: employeeOptions } }),
      },
      {
        id: REMOTE_SESSION_COLUMNS.duration.id,
        header: REMOTE_SESSION_COLUMNS.duration.header,
        // Still-processing recordings have no duration yet - sort them last.
        accessorFn: (row: RecordingSummary) => row.durationMs ?? -1,
        cell: ({ row }: { row: Row<RecordingSummary> }) => {
          const { durationMs, sizeBytes } = row.original;
          return (
            <div className="flex min-w-0 flex-col justify-center gap-[var(--spacing-system-xxs)]">
              <TruncateText>{durationMs != null ? formatDurationMs(durationMs) : '—'}</TruncateText>
              {sizeBytes != null && (
                <TruncateText variant="h6" tone="secondary">
                  {formatBytes(sizeBytes)}
                </TruncateText>
              )}
            </div>
          );
        },
        enableSorting: true,
        meta: liveColumnMeta(REMOTE_SESSION_COLUMNS.duration),
      },
      {
        id: REMOTE_SESSION_COLUMNS.actions.id,
        cell: ({ row }: { row: Row<RecordingSummary> }) => (
          <div
            data-no-row-click
            className="pointer-events-auto flex items-center justify-end gap-[var(--spacing-system-mf)]"
          >
            <Button
              variant="outline"
              size="icon"
              leftIcon={<TrashIcon className="h-6 w-6" />}
              aria-label="Delete recording"
              disabled={row.original.processing}
              onClick={() => setDeleteTarget(row.original)}
            />
            {/* onClick, not `href`: the row itself is a link (rowHref), and an
                anchor nested in an anchor is invalid HTML (hydration error). */}
            <Button
              onClick={() => router.push(routes.devices.remoteSessionRecording(row.original.id))}
              variant="outline"
              size="icon"
              leftIcon={<ArrowRightUpIcon className="h-5 w-5" />}
              aria-label="Open session recording"
              className="bg-ods-card"
            />
          </div>
        ),
        enableSorting: false,
        meta: liveColumnMeta(REMOTE_SESSION_COLUMNS.actions),
      },
    ],
    [dateFilter, employeeOptions, router],
  );

  const table = useDataTable<RecordingSummary>({
    data: recordings,
    columns,
    getRowId: (row: RecordingSummary) => row.id,
    clientSideSorting: true,
    clientSideFiltering: true,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
  });

  // The header only draws the indicator - the consumer owns the toggle cycle
  // (same pattern as the Vulnerabilities tab). TanStack's row model applies the
  // actual client-side sort from the `sorting` state.
  const sortState = sorting[0] ? { id: sorting[0].id, desc: sorting[0].desc } : null;
  const handleSortChange = useCallback((columnId: string) => {
    setSorting(prev => {
      const current = prev[0];
      if (!current || current.id !== columnId) return [{ id: columnId, desc: false }];
      if (!current.desc) return [{ id: columnId, desc: true }];
      return [];
    });
  }, []);

  if (!deviceId) {
    return (
      <TabEmptyState
        icon={<ComputerMouseIcon />}
        title="No remote sessions"
        description="Recorded remote sessions for this device will appear here."
      />
    );
  }

  if (!isLoading && allRecordings.length === 0) {
    return (
      <TabEmptyState
        icon={<ComputerMouseIcon />}
        title="No remote sessions"
        description="Recorded remote sessions for this device will appear here."
      />
    );
  }

  // A narrowed-empty result keeps its controls reachable: the search box (to
  // clear the query) and the header (its calendar is the only way to clear an
  // applied date range). Only a genuinely empty list drops them.
  const hasSearch = debouncedSearch.trim().length > 0;
  const isNarrowed = hasSearch || dateRange !== undefined;
  const isEmpty = recordings.length === 0;

  return (
    <div className="flex flex-col gap-[var(--spacing-system-l)]" style={containerStyle}>
      {(!isEmpty || isNarrowed || isLoading) && (
        <div
          ref={toolbarRef}
          className="sticky top-0 z-20 -my-[var(--spacing-system-l)] flex items-center gap-[var(--spacing-system-m)] bg-ods-bg py-[var(--spacing-system-l)]"
        >
          {/* showDropdown={false}: the input filters the table below - the
              component's own suggestions dropdown ("No results found") makes
              no sense here. */}
          <div className="flex-1">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search for Remote Session"
              showDropdown={false}
            />
          </div>
          {/* On mobile the column funnels are gone with the header cells - the
              standard filters button beside the search opens them as a modal
              (Figma 758-46869, same pattern as the schedule-runs toolbar). */}
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

      <DataTable table={table}>
        {(isLoading || !isEmpty || dateRange !== undefined) && (
          <DataTable.Header
            stickyHeader
            stickyHeaderOffset={stickyHeaderOffset}
            sort={sortState}
            onSortChange={handleSortChange}
            // The results count at the right edge of the header row, per the
            // mockup - counts the table's row model, so search and the
            // employee funnel both narrow it.
            rightSlot={<DataTable.RowCount itemName="result" />}
          />
        )}
        <DataTable.Body
          loading={isLoading}
          skeletonRows={4}
          rowClassName="mb-1"
          rowHref={(recording: RecordingSummary) => routes.devices.remoteSessionRecording(recording.id)}
          emptyState={{
            icon: <ComputerMouseIcon />,
            title: 'No remote sessions found',
            description: debouncedSearch
              ? `No results for "${debouncedSearch}".`
              : dateRange
                ? 'No sessions in the selected date range.'
                : 'Recorded remote sessions for this device will appear here.',
          }}
        />
      </DataTable>

      <FilterModal
        isOpen={mobileFilterOpen}
        onClose={() => setMobileFilterOpen(false)}
        filterGroups={modalFilterGroups}
        currentFilters={modalFilters}
        onFilterChange={handleModalFilterChange}
        sortConfig={modalSortConfig}
        onSort={handleModalSort}
        onSortClear={handleModalSortClear}
        // The SESSION calendar is a desktop header control - on mobile the same
        // session-date sort + range live here, drafted with the other filters.
        // Section order (sort -> groups -> date) is FilterModal's own, shared
        // with every other consumer.
        dateFilter={{
          title: 'Session',
          sort: sessionSortDirection,
          range: dateRange,
          onChange: handleDateFilterApply,
        }}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={open => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete Recording"
        description={
          <>
            Are you sure you want to delete the session recording from{' '}
            <span className="font-medium text-ods-accent">
              {deleteTarget ? formatDateTime(deleteTarget.startedAt) : ''}
            </span>
            ? This cannot be undone.
          </>
        }
        confirmLabel="Delete Recording"
        variant="destructive"
        isPending={deleteRecording.isPending}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteRecording.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
        }}
      />
    </div>
  );
}
