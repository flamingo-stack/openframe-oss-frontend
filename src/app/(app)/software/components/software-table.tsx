'use client';

import { Tag } from '@flamingo-stack/openframe-frontend-core';
import { Parcel02Icon, SearchIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  type ColumnDef,
  DataTable,
  type DataTableSortState,
  Input,
  PageLayout,
  type Row,
  TruncateText,
  useDataTable,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useApiParams } from '@flamingo-stack/openframe-frontend-core/hooks';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useLazyLoadQuery, usePaginationFragment } from 'react-relay';
import type { softwaresTableRelay_query$key as SoftwaresFragmentKey } from '@/__generated__/softwaresTableRelay_query.graphql';
import type { softwaresTableRelayPaginationQuery as SoftwaresPaginationQueryType } from '@/__generated__/softwaresTableRelayPaginationQuery.graphql';
import type {
  SoftwareFilterInput,
  softwaresTableRelayQuery as SoftwaresTableQueryType,
  SortInput,
} from '@/__generated__/softwaresTableRelayQuery.graphql';
import { EmptyState, liveColumnMeta, skeletonColumnDefs, useRetryKey } from '@/app/components/shared';
import { useDeferredQuery } from '@/app/hooks/use-deferred-query';
import { useSearchParam } from '@/app/hooks/use-search-param';
import { useStickyToolbar } from '@/app/hooks/use-sticky-toolbar';
import { SoftwareCveSeverity, SoftwareVersionStatus } from '@/generated/schema-enums';
import { softwaresTableRelayFragment, softwaresTableRelayQuery } from '@/graphql/software/softwares-table-relay';
import { SOFTWARE_LIST_COLUMNS, SOFTWARE_TABLE_COLUMNS } from './software-table-columns';

const PAGE_SIZE = 20;

/**
 * The only values allowed to reach `SortInput.field` — everything else in the
 * URL falls back to the backend's own order. Ids match the column ids of the
 * two sortable headers (DEVICES / VULNS) so the header indicator and the
 * backend field are the same string.
 */
const SORTABLE_COLUMN_IDS = ['devicesCount', 'severity'] as const;

/** Severity → the `Tag` variant that carries its colour. */
const SEVERITY_VARIANT: Record<SoftwareCveSeverity, 'critical' | 'error' | 'warning' | 'grey'> = {
  CRITICAL: 'critical',
  HIGH: 'error',
  MEDIUM: 'warning',
  LOW: 'grey',
  NONE: 'grey',
};

/**
 * Narrow the payload's severity to a severity this build knows. Relay widens
 * every enum with `'%future added value'` — a band added server-side lands here
 * as "no severity we can colour" rather than as a `Tag` with an unmapped variant.
 */
function toSeverity(value: string | null | undefined): SoftwareCveSeverity | null {
  const known = Object.values(SoftwareCveSeverity) as string[];
  return value && known.includes(value) ? (value as SoftwareCveSeverity) : null;
}

interface UiSoftwareEntry {
  id: string;
  name: string;
  publisher: string;
  /** Most-recent version installed anywhere in the fleet; null → "Unknown". */
  currentVersion: string | null;
  outdated: boolean;
  /** Older versions still in use beyond `currentVersion` — the "+N older versions" line. */
  olderVersionsCount: number;
  devicesCount: number | null;
  /** False when the scanner found no matching CPE — "no CPE match" instead of a severity. */
  cpeMatched: boolean;
  severity: SoftwareCveSeverity | null;
  cveCount: number;
}

// ----------------------------------------------------------------
// Inner content — Relay hooks, must live inside Suspense
// ----------------------------------------------------------------

interface SoftwareTableContentProps {
  backendFilters: SoftwareFilterInput | null;
  debouncedSearch: string;
  /** Deferred sort — feeds the query (lags the live indicator during a refetch). */
  sort: SortInput | null;
  /** Live sort — drives the header indicator so it flips instantly on click. */
  sortState: DataTableSortState | null;
  onSortChange: (columnId: string) => void;
  /**
   * True while the deferred query variables lag the live search/sort state (a
   * refetch is in flight and the rows on screen are the previous result) —
   * guards the empty state so it never flashes on stale data.
   */
  isPending: boolean;
  onEmptyChange: (isEmpty: boolean) => void;
  stickyHeaderOffset: string;
  emptyTitle: string;
  emptyDescription: string;
}

function SoftwareTableContent({
  backendFilters,
  debouncedSearch,
  sort,
  sortState,
  onSortChange,
  isPending,
  onEmptyChange,
  stickyHeaderOffset,
  emptyTitle,
  emptyDescription,
}: SoftwareTableContentProps) {
  const retryKey = useRetryKey();
  const queryData = useLazyLoadQuery<SoftwaresTableQueryType>(
    softwaresTableRelayQuery,
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
    SoftwaresPaginationQueryType,
    SoftwaresFragmentKey
  >(softwaresTableRelayFragment, queryData);

  const transformedSoftware: UiSoftwareEntry[] = useMemo(() => {
    const edges = data.softwares?.edges ?? [];
    return edges.flatMap(edge => {
      const node = edge?.node;
      if (!node) return [];
      return [
        {
          id: node.id,
          name: node.name,
          publisher: node.publisher ?? '',
          currentVersion: node.currentVersion ?? null,
          outdated: node.versionStatus === SoftwareVersionStatus.OUTDATED,
          olderVersionsCount: node.olderVersionsCount ?? 0,
          devicesCount: node.devicesCount ?? null,
          // Only an explicit `false` means "scanned, no CPE entry"; a null is
          // simply "not known", which must not print the "no CPE match" note.
          cpeMatched: node.cpeMatched !== false,
          severity: toSeverity(node.vulnerabilitySummary?.highestSeverity),
          cveCount: node.vulnerabilitySummary?.cveCount ?? 0,
        },
      ];
    });
  }, [data.softwares?.edges]);

  const totalCount = data.softwares?.filteredCount ?? transformedSoftware.length;

  const fetchNextPage = useCallback(() => {
    if (hasNext && !isLoadingNext) {
      loadNext(PAGE_SIZE);
    }
  }, [hasNext, isLoadingNext, loadNext]);

  const columns = useMemo<ColumnDef<UiSoftwareEntry>[]>(
    () => [
      {
        accessorKey: 'name',
        header: SOFTWARE_LIST_COLUMNS.name.header,
        cell: ({ row }: { row: Row<UiSoftwareEntry> }) => (
          <div className="flex min-w-0 flex-col justify-center">
            <TruncateText>{row.original.name}</TruncateText>
            {row.original.publisher && (
              <TruncateText variant="h6" tone="secondary">
                {row.original.publisher}
              </TruncateText>
            )}
          </div>
        ),
        enableSorting: false,
        meta: liveColumnMeta(SOFTWARE_LIST_COLUMNS.name),
      },
      {
        accessorKey: 'currentVersion',
        header: SOFTWARE_LIST_COLUMNS.currentVersion.header,
        cell: ({ row }: { row: Row<UiSoftwareEntry> }) => (
          <div className="flex min-w-0 flex-col justify-center">
            <div className="flex min-w-0 items-center gap-[var(--spacing-system-xxs)]">
              <TruncateText>{row.original.currentVersion ?? 'Unknown'}</TruncateText>
              {row.original.outdated && <Tag label="OUTDATED" variant="warning" />}
            </div>
            {row.original.olderVersionsCount > 0 && (
              <TruncateText variant="h6" tone="secondary">
                {`+${row.original.olderVersionsCount} older version${row.original.olderVersionsCount === 1 ? '' : 's'}`}
              </TruncateText>
            )}
          </div>
        ),
        enableSorting: false,
        meta: liveColumnMeta(SOFTWARE_LIST_COLUMNS.currentVersion),
      },
      {
        accessorKey: 'devicesCount',
        header: SOFTWARE_LIST_COLUMNS.devicesCount.header,
        cell: ({ row }: { row: Row<UiSoftwareEntry> }) => (
          <span className="text-ods-text-primary text-h4">{row.original.devicesCount ?? '—'}</span>
        ),
        enableSorting: false,
        meta: liveColumnMeta(SOFTWARE_LIST_COLUMNS.devicesCount),
      },
      {
        // Column id is the backend sort field, like every other sortable column.
        id: 'severity',
        header: SOFTWARE_LIST_COLUMNS.vulnerabilities.header,
        cell: ({ row }: { row: Row<UiSoftwareEntry> }) => {
          const { severity, cveCount, cpeMatched } = row.original;
          const hasVulnerabilities = severity !== null && severity !== SoftwareCveSeverity.NONE && cveCount > 0;
          return (
            <div className="flex min-w-0 flex-col justify-center">
              {hasVulnerabilities ? (
                <Tag label={severity} variant={SEVERITY_VARIANT[severity]} />
              ) : (
                <span className="text-ods-text-primary text-h4">—</span>
              )}
              {hasVulnerabilities ? (
                <TruncateText variant="h6" tone="secondary">
                  {`${cveCount} CVE${cveCount === 1 ? '' : 's'}`}
                </TruncateText>
              ) : (
                !cpeMatched && (
                  <TruncateText variant="h6" tone="secondary">
                    no CPE match
                  </TruncateText>
                )
              )}
            </div>
          );
        },
        enableSorting: false,
        meta: liveColumnMeta(SOFTWARE_LIST_COLUMNS.vulnerabilities),
      },
    ],
    [],
  );

  const table = useDataTable<UiSoftwareEntry>({
    data: transformedSoftware,
    columns,
    getRowId: (row: UiSoftwareEntry) => row.id,
    enableSorting: false,
  });

  const showEmptyState = !debouncedSearch && !isPending && transformedSoftware.length === 0;

  useEffect(() => {
    onEmptyChange(showEmptyState);
  }, [showEmptyState, onEmptyChange]);

  if (showEmptyState) {
    return <EmptyState icon={<Parcel02Icon />} title={emptyTitle} description={emptyDescription} />;
  }

  return (
    // Dim (don't unmount) the stale rows while a deferred refetch is in flight —
    // the subtle fade is the pending feedback. Swapping to skeletons is exactly
    // the flash the deferral avoids.
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
              ? `No software found matching "${debouncedSearch}". Try adjusting your search.`
              : 'No software found.'
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

const EMPTY_ROWS: UiSoftwareEntry[] = [];

function SoftwareTableSkeleton({ stickyHeaderOffset }: { stickyHeaderOffset: string }) {
  // Same layout the live table renders, so the loading header reserves the same
  // widths and stays aligned.
  const columns = useMemo<ColumnDef<UiSoftwareEntry>[]>(
    () => skeletonColumnDefs<UiSoftwareEntry>(SOFTWARE_TABLE_COLUMNS),
    [],
  );

  const table = useDataTable<UiSoftwareEntry>({
    data: EMPTY_ROWS,
    columns,
    getRowId: (row: UiSoftwareEntry) => row.id,
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

export interface SoftwareTableProps {
  /** Page title, e.g. "All Software". */
  title: string;
  /**
   * Fixed server-side scope of this tab (null = the whole inventory). Owned by
   * the page, not the user — the list has no filter funnels.
   */
  scopeFilter?: SoftwareFilterInput | null;
  emptyTitle: string;
  emptyDescription: string;
}

/**
 * The Software inventory table — one row per software title, aggregated across
 * the fleet. Shared by the three Software tabs, which differ only in the fixed
 * `scopeFilter` they pass.
 */
export function SoftwareTable({ title, scopeFilter = null, emptyTitle, emptyDescription }: SoftwareTableProps) {
  const { params, setParam, setParams } = useApiParams({
    search: { type: 'string', default: '' },
    // Server-side sort: backend sort field ('devicesCount' / 'severity' from the
    // two header toggles) + direction. Empty sortBy = backend default order.
    sortBy: { type: 'string', default: '' },
    sortDir: { type: 'string', default: 'desc' },
  });

  // Local search input keeps typing responsive; the shared hook debounces it to
  // the URL param and guards the back/forward sync-down against clobbering typing.
  const {
    search: searchInput,
    setSearch: setSearchInput,
    debouncedSearch,
  } = useSearchParam(params.search, value => setParam('search', value), 300);

  const [isEmpty, setIsEmpty] = useState(false);
  const { toolbarRef, containerStyle, stickyHeaderOffset } = useStickyToolbar();

  // `sortBy` arrives from the URL, so it is user input: a hand-edited or stale
  // link would otherwise travel straight into `SortInput.field` and surface as a
  // GraphQL error inside the Suspense boundary, with no way back from the page.
  const sortBy = (SORTABLE_COLUMN_IDS as readonly string[]).includes(params.sortBy) ? params.sortBy : '';

  const sortInput = useMemo<SortInput | null>(
    () => (sortBy ? { field: sortBy, direction: params.sortDir === 'asc' ? 'ASC' : 'DESC' } : null),
    [sortBy, params.sortDir],
  );

  // Live descriptor the header renders its indicator from (flips instantly on click).
  const sortState = useMemo<DataTableSortState | null>(
    () => (sortBy ? { id: sortBy, desc: params.sortDir !== 'asc' } : null),
    [sortBy, params.sortDir],
  );

  // Scope + sort travel together as one deferred object so the query lags in
  // lockstep and `isPending` covers both.
  const queryVars = useMemo(() => ({ filter: scopeFilter, sort: sortInput }), [scopeFilter, sortInput]);
  const { deferredFilters: deferredVars, deferredSearch, isPending } = useDeferredQuery(queryVars, debouncedSearch);

  // 3-state toggle owned by the consumer (per DataTable.Header contract):
  // unsorted → desc → asc → unsorted. `columnId` is the column's id, which
  // equals the backend sort field.
  //
  // `sortDir: ''` — NOT `'desc'` — whenever the direction is the default one:
  // `useApiParams` drops a param from the URL only when the value is empty, it
  // never compares against the schema default. Writing `'desc'` would leave a
  // stale `?sortDir=desc` behind on an unsorted list.
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

  return (
    // No page padding here: it lives on the wrapper around `ContentErrorBoundary`
    // (see the pages), so a thrown query keeps the title indented instead of
    // taking the padding down with the layout that declared it.
    <PageLayout title={title}>
      <div className="flex flex-col" style={containerStyle}>
        {!isEmpty && (
          <div
            ref={toolbarRef}
            className="sticky top-0 z-20 -mx-[var(--spacing-system-l)] -mt-[var(--spacing-system-l)] flex items-center gap-[var(--spacing-system-m)] bg-ods-bg p-[var(--spacing-system-l)]"
          >
            <Input
              placeholder="Search for Software"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="flex-1"
              startAdornment={<SearchIcon className="h-4 w-4 md:h-6 md:w-6" />}
            />
          </div>
        )}

        <Suspense fallback={<SoftwareTableSkeleton stickyHeaderOffset={stickyHeaderOffset} />}>
          <SoftwareTableContent
            backendFilters={deferredVars.filter}
            debouncedSearch={deferredSearch}
            sort={deferredVars.sort}
            sortState={sortState}
            onSortChange={handleSortChange}
            isPending={isPending}
            onEmptyChange={setIsEmpty}
            stickyHeaderOffset={stickyHeaderOffset}
            emptyTitle={emptyTitle}
            emptyDescription={emptyDescription}
          />
        </Suspense>
      </div>
    </PageLayout>
  );
}
