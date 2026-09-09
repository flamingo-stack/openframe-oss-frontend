'use client';

import { Tag } from '@flamingo-stack/openframe-frontend-core';
import { ArrowRightUpIcon, SearchIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Button,
  type ColumnDef,
  DataTable,
  type DataTableSortState,
  Input,
  type Row,
  TruncateText,
  useDataTable,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useApiParams } from '@flamingo-stack/openframe-frontend-core/hooks';
import { differenceInCalendarDays } from 'date-fns';
import { memo, Suspense, useCallback, useMemo } from 'react';
import { useLazyLoadQuery, usePaginationFragment } from 'react-relay';
import type { softwareVulnerabilitiesRelay_query$key as VulnerabilitiesFragmentKey } from '@/__generated__/softwareVulnerabilitiesRelay_query.graphql';
import type { softwareVulnerabilitiesRelayPaginationQuery as VulnerabilitiesPaginationQueryType } from '@/__generated__/softwareVulnerabilitiesRelayPaginationQuery.graphql';
import type {
  SoftwareVulnerabilityFilterInput,
  softwareVulnerabilitiesRelayQuery as VulnerabilitiesQueryType,
  SortInput,
} from '@/__generated__/softwareVulnerabilitiesRelayQuery.graphql';
import { liveColumnMeta, skeletonColumnDefs, useRetryKey } from '@/app/components/shared';
import { useDeferredQuery } from '@/app/hooks/use-deferred-query';
import { useSearchParam } from '@/app/hooks/use-search-param';
import { useStickyToolbar } from '@/app/hooks/use-sticky-toolbar';
import { SoftwareCveSeverity } from '@/generated/schema-enums';
import {
  softwareVulnerabilitiesRelayFragment,
  softwareVulnerabilitiesRelayQuery,
} from '@/graphql/software/software-vulnerabilities-relay';
import { formatDate } from '@/lib/format-date';
import { multiSelectFilterFn } from '@/lib/table-filters';
import { SOFTWARE_VULNERABILITIES_TABLE_COLUMNS, SOFTWARE_VULNERABILITY_COLUMNS } from './software-detail-columns';
import type { SoftwareTabProps } from './software-devices-tab';
import { severityVariant, toSeverity } from './software-tags';

const PAGE_SIZE = 20;

/**
 * TanStack's column-filter state as `useDataTable` hands it back. Declared
 * structurally rather than imported: @tanstack/react-table is the core library's
 * dependency, not this app's, so importing it here would be an undeclared one.
 */
type ColumnFilterState = { id: string; value: unknown }[];

/** Backend sort fields this list offers — anything else in the URL is ignored. */
const SORTABLE_COLUMN_IDS = ['affectedVersion', 'publishedAt'] as const;

/** Severity funnel options, highest band first. */
const SEVERITY_OPTIONS = [
  { id: SoftwareCveSeverity.CRITICAL, label: 'Critical', value: SoftwareCveSeverity.CRITICAL },
  { id: SoftwareCveSeverity.HIGH, label: 'High', value: SoftwareCveSeverity.HIGH },
  { id: SoftwareCveSeverity.MEDIUM, label: 'Medium', value: SoftwareCveSeverity.MEDIUM },
  { id: SoftwareCveSeverity.LOW, label: 'Low', value: SoftwareCveSeverity.LOW },
];

/**
 * Where a CVE is read in full. The schema carries no details link for a
 * `SoftwareVulnerability`, and NVD is the canonical record every CVE id resolves
 * against — the same place the device Vulnerabilities tab's link points at.
 */
function nvdUrl(cveId: string): string {
  return `https://nvd.nist.gov/vuln/detail/${encodeURIComponent(cveId)}`;
}

interface UiVulnerability {
  cveId: string;
  severity: SoftwareCveSeverity | null;
  cvssScore: number | null;
  affectedVersion: string | null;
  publishedAt: string | null;
}

// ----------------------------------------------------------------
// Inner content — Relay hooks, must live inside Suspense
// ----------------------------------------------------------------

interface VulnerabilitiesContentProps {
  softwareId: string;
  backendFilters: SoftwareVulnerabilityFilterInput | null;
  debouncedSearch: string;
  sort: SortInput | null;
  sortState: DataTableSortState | null;
  onSortChange: (columnId: string) => void;
  severityFilter: string[];
  onSeverityFilterChange: (values: string[]) => void;
  isPending: boolean;
  stickyHeaderOffset: string;
}

function VulnerabilitiesContent({
  softwareId,
  backendFilters,
  debouncedSearch,
  sort,
  sortState,
  onSortChange,
  severityFilter,
  onSeverityFilterChange,
  isPending,
  stickyHeaderOffset,
}: VulnerabilitiesContentProps) {
  const retryKey = useRetryKey();
  const queryData = useLazyLoadQuery<VulnerabilitiesQueryType>(
    softwareVulnerabilitiesRelayQuery,
    {
      softwareId,
      filter: backendFilters,
      search: debouncedSearch || null,
      sort,
      first: PAGE_SIZE,
      after: null,
    },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );

  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    VulnerabilitiesPaginationQueryType,
    VulnerabilitiesFragmentKey
  >(softwareVulnerabilitiesRelayFragment, queryData);

  const rows: UiVulnerability[] = useMemo(() => {
    const edges = data.softwareVulnerabilities?.edges ?? [];
    return edges.flatMap(edge => {
      const node = edge?.node;
      if (!node) return [];
      return [
        {
          cveId: node.cveId,
          severity: toSeverity(node.severity),
          cvssScore: node.cvssScore ?? null,
          affectedVersion: node.affectedVersion ?? null,
          publishedAt: node.publishedAt ?? null,
        },
      ];
    });
  }, [data.softwareVulnerabilities?.edges]);

  const totalCount = data.softwareVulnerabilities?.filteredCount ?? rows.length;

  const fetchNextPage = useCallback(() => {
    if (hasNext && !isLoadingNext) {
      loadNext(PAGE_SIZE);
    }
  }, [hasNext, isLoadingNext, loadNext]);

  const columns = useMemo<ColumnDef<UiVulnerability>[]>(
    () => [
      {
        accessorKey: 'cveId',
        header: SOFTWARE_VULNERABILITY_COLUMNS.cveId.header,
        cell: ({ row }: { row: Row<UiVulnerability> }) => <TruncateText>{row.original.cveId}</TruncateText>,
        enableSorting: false,
        meta: liveColumnMeta(SOFTWARE_VULNERABILITY_COLUMNS.cveId),
      },
      {
        accessorKey: 'severity',
        header: SOFTWARE_VULNERABILITY_COLUMNS.severity.header,
        cell: ({ row }: { row: Row<UiVulnerability> }) => {
          const { severity, cvssScore } = row.original;
          if (!severity) return <span className="text-ods-text-primary text-h4">—</span>;
          // Band and score in one chip, as designed — the score alone doesn't
          // say how bad it is, and the band alone loses the precision.
          const label = cvssScore != null ? `${severity} ${cvssScore}` : severity;
          return <Tag label={label} variant={severityVariant(severity)} />;
        },
        enableSorting: false,
        filterFn: multiSelectFilterFn,
        meta: liveColumnMeta(SOFTWARE_VULNERABILITY_COLUMNS.severity, { filter: { options: SEVERITY_OPTIONS } }),
      },
      {
        id: 'affectedVersion',
        header: SOFTWARE_VULNERABILITY_COLUMNS.affectedVersion.header,
        cell: ({ row }: { row: Row<UiVulnerability> }) => (
          <TruncateText>{row.original.affectedVersion ?? '—'}</TruncateText>
        ),
        enableSorting: false,
        meta: liveColumnMeta(SOFTWARE_VULNERABILITY_COLUMNS.affectedVersion),
      },
      {
        id: 'publishedAt',
        header: SOFTWARE_VULNERABILITY_COLUMNS.publishedAt.header,
        cell: ({ row }: { row: Row<UiVulnerability> }) => {
          const { publishedAt } = row.original;
          if (!publishedAt) return <span className="text-ods-text-primary text-h4">—</span>;
          const published = new Date(publishedAt);
          if (Number.isNaN(published.getTime())) {
            return <TruncateText>{publishedAt}</TruncateText>;
          }
          // "N days" is the age of the CVE — how long the fleet has been exposed,
          // which is the number that matters here, not the calendar date alone.
          const days = differenceInCalendarDays(new Date(), published);
          return (
            <div className="flex min-w-0 flex-col justify-center">
              <TruncateText>{formatDate(published)}</TruncateText>
              <TruncateText variant="h6" tone="secondary">
                {days === 1 ? '1 day' : `${days} days`}
              </TruncateText>
            </div>
          );
        },
        enableSorting: false,
        meta: liveColumnMeta(SOFTWARE_VULNERABILITY_COLUMNS.publishedAt),
      },
      {
        id: 'open',
        cell: ({ row }: { row: Row<UiVulnerability> }) => (
          <div data-no-row-click className="pointer-events-auto flex items-center justify-end">
            <Button
              onClick={() => window.open(nvdUrl(row.original.cveId), '_blank', 'noopener,noreferrer')}
              variant="outline"
              size="icon"
              leftIcon={<ArrowRightUpIcon className="h-5 w-5" />}
              aria-label={`Open ${row.original.cveId} on NVD`}
              className="bg-ods-card"
            />
          </div>
        ),
        enableSorting: false,
        meta: liveColumnMeta(SOFTWARE_VULNERABILITY_COLUMNS.open),
      },
    ],
    [],
  );

  const columnFilters = useMemo<ColumnFilterState>(
    () => (severityFilter.length > 0 ? [{ id: 'severity', value: severityFilter }] : []),
    [severityFilter],
  );

  const handleColumnFiltersChange = useCallback(
    // TanStack's updater signature: either the next state or a reducer over it.
    (updater: ColumnFilterState | ((prev: ColumnFilterState) => ColumnFilterState)) => {
      const next = typeof updater === 'function' ? updater(columnFilters) : updater;
      const values = next.find(f => f.id === 'severity')?.value;
      onSeverityFilterChange(Array.isArray(values) ? (values as string[]) : []);
    },
    [columnFilters, onSeverityFilterChange],
  );

  const table = useDataTable<UiVulnerability>({
    data: rows,
    columns,
    getRowId: (row: UiVulnerability) => row.cveId,
    enableSorting: false,
    state: { columnFilters },
    onColumnFiltersChange: handleColumnFiltersChange,
  });

  return (
    <div className={`transition-opacity duration-200 ${isPending ? 'opacity-60' : ''}`}>
      <DataTable table={table}>
        <DataTable.Header
          stickyHeader
          stickyHeaderOffset={stickyHeaderOffset}
          rightSlot={<DataTable.RowCount itemName="result" totalCount={totalCount} />}
          sort={sortState}
          onSortChange={onSortChange}
        />
        <DataTable.Body
          skeletonRows={PAGE_SIZE}
          emptyMessage={
            debouncedSearch
              ? `No vulnerabilities found matching "${debouncedSearch}". Try adjusting your search.`
              : 'No known vulnerabilities for this software.'
          }
          rowClassName="mb-1"
          autoHeight
        />
        <DataTable.InfiniteFooter
          hasNextPage={hasNext}
          isFetchingNextPage={isLoadingNext}
          onLoadMore={fetchNextPage}
          skeletonRows={2}
        />
      </DataTable>
    </div>
  );
}

// ----------------------------------------------------------------
// Loading skeleton
// ----------------------------------------------------------------

const EMPTY_ROWS: UiVulnerability[] = [];

function VulnerabilitiesSkeleton({ stickyHeaderOffset }: { stickyHeaderOffset: string }) {
  const columns = useMemo<ColumnDef<UiVulnerability>[]>(
    () => skeletonColumnDefs<UiVulnerability>(SOFTWARE_VULNERABILITIES_TABLE_COLUMNS),
    [],
  );

  const table = useDataTable<UiVulnerability>({
    data: EMPTY_ROWS,
    columns,
    getRowId: (row: UiVulnerability) => row.cveId,
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
// Tab shell — URL state + Suspense boundary
// ----------------------------------------------------------------

/** Software → Vulnerabilities: the CVEs matched to this title. */
export const SoftwareVulnerabilitiesTab = memo(function SoftwareVulnerabilitiesTabImpl({
  softwareId,
}: SoftwareTabProps) {
  const { params, setParam, setParams } = useApiParams({
    cveSearch: { type: 'string', default: '' },
    cveSeverity: { type: 'array', default: [] },
    cveSortBy: { type: 'string', default: '' },
    cveSortDir: { type: 'string', default: 'desc' },
  });

  const {
    search: searchInput,
    setSearch: setSearchInput,
    debouncedSearch,
  } = useSearchParam(params.cveSearch, value => setParam('cveSearch', value), 300);

  const { toolbarRef, containerStyle, stickyHeaderOffset } = useStickyToolbar();

  const backendFilters = useMemo<SoftwareVulnerabilityFilterInput | null>(
    () =>
      params.cveSeverity.length > 0
        ? { severities: params.cveSeverity as SoftwareVulnerabilityFilterInput['severities'] }
        : null,
    [params.cveSeverity],
  );

  const sortBy = (SORTABLE_COLUMN_IDS as readonly string[]).includes(params.cveSortBy) ? params.cveSortBy : '';

  const sortInput = useMemo<SortInput | null>(
    () => (sortBy ? { field: sortBy, direction: params.cveSortDir === 'asc' ? 'ASC' : 'DESC' } : null),
    [sortBy, params.cveSortDir],
  );

  const sortState = useMemo<DataTableSortState | null>(
    () => (sortBy ? { id: sortBy, desc: params.cveSortDir !== 'asc' } : null),
    [sortBy, params.cveSortDir],
  );

  const queryVars = useMemo(() => ({ filter: backendFilters, sort: sortInput }), [backendFilters, sortInput]);
  const { deferredFilters: deferredVars, deferredSearch, isPending } = useDeferredQuery(queryVars, debouncedSearch);

  const handleSortChange = useCallback(
    (columnId: string) => {
      if (sortBy !== columnId) {
        setParams({ cveSortBy: columnId, cveSortDir: '' });
      } else if (params.cveSortDir === 'desc') {
        setParams({ cveSortDir: 'asc' });
      } else {
        setParams({ cveSortBy: '', cveSortDir: '' });
      }
      document.querySelector('main')?.scrollTo({ top: 0, behavior: 'instant' });
    },
    [sortBy, params.cveSortDir, setParams],
  );

  const handleSeverityFilterChange = useCallback((values: string[]) => setParam('cveSeverity', values), [setParam]);

  return (
    <div className="flex flex-col pt-[var(--spacing-system-l)]" style={containerStyle}>
      <div
        ref={toolbarRef}
        className="sticky top-0 z-20 -mx-[var(--spacing-system-l)] -mt-[var(--spacing-system-l)] flex items-center gap-[var(--spacing-system-m)] bg-ods-bg p-[var(--spacing-system-l)]"
      >
        <Input
          placeholder="Search for Vulnerability"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          className="flex-1"
          startAdornment={<SearchIcon className="h-4 w-4 md:h-6 md:w-6" />}
        />
      </div>

      <Suspense fallback={<VulnerabilitiesSkeleton stickyHeaderOffset={stickyHeaderOffset} />}>
        <VulnerabilitiesContent
          softwareId={softwareId}
          backendFilters={deferredVars.filter}
          debouncedSearch={deferredSearch}
          sort={deferredVars.sort}
          sortState={sortState}
          onSortChange={handleSortChange}
          severityFilter={params.cveSeverity}
          onSeverityFilterChange={handleSeverityFilterChange}
          isPending={isPending}
          stickyHeaderOffset={stickyHeaderOffset}
        />
      </Suspense>
    </div>
  );
});
SoftwareVulnerabilitiesTab.displayName = 'SoftwareVulnerabilitiesTab';
