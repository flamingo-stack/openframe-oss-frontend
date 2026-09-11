'use client';

import { PageLayout, Tag } from '@flamingo-stack/openframe-frontend-core';
import { ArrowRightUpIcon, SearchIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Button,
  type ColumnDef,
  DataTable,
  Input,
  type Row,
  TruncateText,
  useDataTable,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useApiParams } from '@flamingo-stack/openframe-frontend-core/hooks';
import { differenceInCalendarDays } from 'date-fns';
import { Suspense, useCallback, useMemo } from 'react';
import { useLazyLoadQuery, usePaginationFragment } from 'react-relay';
import type { vulnerabilitiesTableRelay_query$key as VulnerabilitiesFragmentKey } from '@/__generated__/vulnerabilitiesTableRelay_query.graphql';
import type { vulnerabilitiesTableRelayPaginationQuery as VulnerabilitiesPaginationQueryType } from '@/__generated__/vulnerabilitiesTableRelayPaginationQuery.graphql';
import type {
  vulnerabilitiesTableRelayQuery as VulnerabilitiesQueryType,
  VulnerabilityFilterInput,
} from '@/__generated__/vulnerabilitiesTableRelayQuery.graphql';
import { liveColumnMeta, skeletonColumnDefs, useRetryKey } from '@/app/components/shared';
import { useDeferredQuery } from '@/app/hooks/use-deferred-query';
import { useSearchParam } from '@/app/hooks/use-search-param';
import { useStickyToolbar } from '@/app/hooks/use-sticky-toolbar';
import { SoftwareCveSeverity } from '@/generated/schema-enums';
import {
  vulnerabilitiesTableRelayFragment,
  vulnerabilitiesTableRelayQuery,
} from '@/graphql/software/vulnerabilities-table-relay';
import { formatDate } from '@/lib/format-date';
import { openInNewTab } from '@/lib/open-in-new-tab';
import { routes } from '@/lib/routes';
import { severityVariant, toSeverity } from './software-tags';
import { VULNERABILITY_LIST_COLUMNS, VULNERABILITY_LIST_TABLE_COLUMNS } from './vulnerability-columns';

const PAGE_SIZE = 20;

/**
 * TanStack's column-filter state as `useDataTable` hands it back. Declared
 * structurally rather than imported: @tanstack/react-table is the core library's
 * dependency, not this app's, so importing it here would be an undeclared one.
 */
type ColumnFilterState = { id: string; value: unknown }[];

/** Highest band first — also the order `lowestSelected` ranks by. */
const SEVERITY_BANDS = [
  SoftwareCveSeverity.CRITICAL,
  SoftwareCveSeverity.HIGH,
  SoftwareCveSeverity.MEDIUM,
  SoftwareCveSeverity.LOW,
] as const;

/**
 * The backend filter is a cut-off (`minSeverity`), not a set of bands, so the
 * funnel speaks in thresholds: each option means "this band and worse".
 */
const SEVERITY_OPTIONS = [
  { id: SoftwareCveSeverity.CRITICAL, label: 'Critical', value: SoftwareCveSeverity.CRITICAL },
  { id: SoftwareCveSeverity.HIGH, label: 'High and above', value: SoftwareCveSeverity.HIGH },
  { id: SoftwareCveSeverity.MEDIUM, label: 'Medium and above', value: SoftwareCveSeverity.MEDIUM },
  { id: SoftwareCveSeverity.LOW, label: 'Low and above', value: SoftwareCveSeverity.LOW },
];

/**
 * Several thresholds ticked at once collapse to the loosest of them — the only
 * reading under which every ticked option stays true of the rows shown.
 */
function lowestSelected(values: string[]): SoftwareCveSeverity | null {
  for (let i = SEVERITY_BANDS.length - 1; i >= 0; i--) {
    if (values.includes(SEVERITY_BANDS[i])) return SEVERITY_BANDS[i];
  }
  return null;
}

/** The server already applied the threshold; the table must not filter the page again. */
const SERVER_FILTERED = () => true;

interface UiVulnerability {
  cveId: string;
  severity: SoftwareCveSeverity | null;
  cvssScore: number | null;
  publishedAt: string | null;
  devicesCount: number | null;
}

export function PublishedCell({ publishedAt }: { publishedAt: string | null }) {
  if (!publishedAt) return <span className="text-ods-text-primary text-h4">—</span>;
  const published = new Date(publishedAt);
  if (Number.isNaN(published.getTime())) {
    return <TruncateText>{publishedAt}</TruncateText>;
  }
  // "N days" is the age of the CVE — how long the fleet has been exposed.
  const days = differenceInCalendarDays(new Date(), published);
  return (
    <div className="flex min-w-0 flex-col justify-center">
      <TruncateText>{formatDate(published)}</TruncateText>
      <TruncateText variant="h6" tone="secondary">
        {days === 1 ? '1 day' : `${days} days`}
      </TruncateText>
    </div>
  );
}

// ----------------------------------------------------------------
// Inner content — Relay hooks, must live inside Suspense
// ----------------------------------------------------------------

interface VulnerabilitiesContentProps {
  backendFilters: VulnerabilityFilterInput | null;
  debouncedSearch: string;
  severityFilter: string[];
  onSeverityFilterChange: (values: string[]) => void;
  isPending: boolean;
  stickyHeaderOffset: string;
}

function VulnerabilitiesContent({
  backendFilters,
  debouncedSearch,
  severityFilter,
  onSeverityFilterChange,
  isPending,
  stickyHeaderOffset,
}: VulnerabilitiesContentProps) {
  const retryKey = useRetryKey();
  const queryData = useLazyLoadQuery<VulnerabilitiesQueryType>(
    vulnerabilitiesTableRelayQuery,
    { filter: backendFilters, search: debouncedSearch || null, first: PAGE_SIZE, after: null },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );

  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    VulnerabilitiesPaginationQueryType,
    VulnerabilitiesFragmentKey
  >(vulnerabilitiesTableRelayFragment, queryData);

  const rows: UiVulnerability[] = useMemo(
    () =>
      (data.vulnerabilities?.edges ?? []).map(({ node }) => ({
        cveId: node.cveId,
        severity: toSeverity(node.severity),
        cvssScore: node.cvssScore ?? null,
        publishedAt: node.publishedAt ?? null,
        devicesCount: node.devicesCount ?? null,
      })),
    [data.vulnerabilities?.edges],
  );

  const totalCount = data.vulnerabilities?.filteredCount ?? rows.length;

  const fetchNextPage = useCallback(() => {
    if (hasNext && !isLoadingNext) {
      loadNext(PAGE_SIZE);
    }
  }, [hasNext, isLoadingNext, loadNext]);

  const columns = useMemo<ColumnDef<UiVulnerability>[]>(
    () => [
      {
        accessorKey: 'cveId',
        header: VULNERABILITY_LIST_COLUMNS.cveId.header,
        cell: ({ row }: { row: Row<UiVulnerability> }) => <TruncateText>{row.original.cveId}</TruncateText>,
        enableSorting: false,
        meta: liveColumnMeta(VULNERABILITY_LIST_COLUMNS.cveId),
      },
      {
        accessorKey: 'severity',
        header: VULNERABILITY_LIST_COLUMNS.severity.header,
        cell: ({ row }: { row: Row<UiVulnerability> }) => {
          const { severity, cvssScore } = row.original;
          if (!severity) return <span className="text-ods-text-primary text-h4">—</span>;
          const label = cvssScore != null ? `${severity} ${cvssScore}` : severity;
          return <Tag label={label} variant={severityVariant(severity)} />;
        },
        enableSorting: false,
        filterFn: SERVER_FILTERED,
        meta: liveColumnMeta(VULNERABILITY_LIST_COLUMNS.severity, { filter: { options: SEVERITY_OPTIONS } }),
      },
      {
        id: 'devicesCount',
        header: VULNERABILITY_LIST_COLUMNS.devicesCount.header,
        cell: ({ row }: { row: Row<UiVulnerability> }) => (
          <TruncateText>{row.original.devicesCount != null ? String(row.original.devicesCount) : '—'}</TruncateText>
        ),
        enableSorting: false,
        meta: liveColumnMeta(VULNERABILITY_LIST_COLUMNS.devicesCount),
      },
      {
        id: 'publishedAt',
        header: VULNERABILITY_LIST_COLUMNS.publishedAt.header,
        cell: ({ row }: { row: Row<UiVulnerability> }) => <PublishedCell publishedAt={row.original.publishedAt} />,
        enableSorting: false,
        meta: liveColumnMeta(VULNERABILITY_LIST_COLUMNS.publishedAt),
      },
      {
        id: 'open',
        cell: ({ row }: { row: Row<UiVulnerability> }) => (
          <div data-no-row-click className="pointer-events-auto flex items-center justify-end">
            <Button
              onClick={openInNewTab(routes.software.vulnerability(row.original.cveId))}
              variant="outline"
              size="icon"
              leftIcon={<ArrowRightUpIcon className="h-5 w-5" />}
              aria-label={`Open ${row.original.cveId} in new tab`}
              className="bg-ods-card"
            />
          </div>
        ),
        enableSorting: false,
        meta: liveColumnMeta(VULNERABILITY_LIST_COLUMNS.open),
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

  const rowHref = useCallback((row: UiVulnerability) => routes.software.vulnerability(row.cveId), []);

  return (
    <div className={`transition-opacity duration-200 ${isPending ? 'opacity-60' : ''}`}>
      <DataTable table={table}>
        <DataTable.Header
          stickyHeader
          stickyHeaderOffset={stickyHeaderOffset}
          rightSlot={<DataTable.RowCount itemName="result" totalCount={totalCount} />}
        />
        <DataTable.Body
          skeletonRows={PAGE_SIZE}
          emptyMessage={
            debouncedSearch
              ? `No vulnerabilities found matching "${debouncedSearch}". Try adjusting your search.`
              : 'No known vulnerabilities across the fleet.'
          }
          rowClassName="mb-1"
          rowHref={rowHref}
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
    () => skeletonColumnDefs<UiVulnerability>(VULNERABILITY_LIST_TABLE_COLUMNS),
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
// Page shell — URL state + Suspense boundary
// ----------------------------------------------------------------

/** `/software/vulnerabilities`: every CVE across the fleet (design 1:10075). */
export function VulnerabilitiesTable() {
  const { params, setParam } = useApiParams({
    search: { type: 'string', default: '' },
    severity: { type: 'array', default: [] },
  });

  const {
    search: searchInput,
    setSearch: setSearchInput,
    debouncedSearch,
  } = useSearchParam(params.search, value => setParam('search', value), 300);

  const { toolbarRef, containerStyle, stickyHeaderOffset } = useStickyToolbar();

  const minSeverity = lowestSelected(params.severity);
  const backendFilters = useMemo<VulnerabilityFilterInput | null>(
    () => (minSeverity ? { minSeverity } : null),
    [minSeverity],
  );

  const { deferredFilters, deferredSearch, isPending } = useDeferredQuery(backendFilters, debouncedSearch);

  const handleSeverityFilterChange = useCallback((values: string[]) => setParam('severity', values), [setParam]);

  return (
    // No page padding here: it lives on the wrapper around `ContentErrorBoundary`
    // (see the page), so a thrown query keeps the title indented.
    <PageLayout title="Vulnerabilities">
      <div className="flex flex-col" style={containerStyle}>
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
            backendFilters={deferredFilters}
            debouncedSearch={deferredSearch}
            severityFilter={params.severity}
            onSeverityFilterChange={handleSeverityFilterChange}
            isPending={isPending}
            stickyHeaderOffset={stickyHeaderOffset}
          />
        </Suspense>
      </div>
    </PageLayout>
  );
}
