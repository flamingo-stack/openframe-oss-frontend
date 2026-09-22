'use client';

import { BracketSquareCheckIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  type ColumnDef,
  DataTable,
  type DataTableSortState,
  type Row,
  TruncateText,
  useDataTable,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useEffect } from 'react';
import { graphql, useLazyLoadQuery, usePaginationFragment } from 'react-relay';
import type {
  softwareVulnerabilitiesTable_query$data,
  softwareVulnerabilitiesTable_query$key,
} from '@/__generated__/softwareVulnerabilitiesTable_query.graphql';
import type { softwareVulnerabilitiesTablePaginationQuery as SoftwareVulnerabilitiesTablePaginationQueryType } from '@/__generated__/softwareVulnerabilitiesTablePaginationQuery.graphql';
import type {
  softwareVulnerabilitiesTableQuery as SoftwareVulnerabilitiesTableQueryType,
  SortInput,
} from '@/__generated__/softwareVulnerabilitiesTableQuery.graphql';
import { EmptyState, liveColumnMeta, useRetryKey } from '@/app/components/shared';
import { openNvd } from '../../shared/nvd-url';
import { OpenRowButton } from '../../shared/open-row-button';
import { SOFTWARE_VULNERABILITIES_PAGE_SIZE, SOFTWARE_VULNERABILITY_COLUMNS } from './software-vulnerabilities-columns';
import { SoftwareVulnerabilityDiscoveredCell } from './software-vulnerability-discovered-cell';
import { SoftwareVulnerabilityVersionCell } from './software-vulnerability-version-cell';

/**
 * Software → Vulnerabilities: the CVEs matched to this title. One row per CVE
 * × affected fleet version — a CVE that hits several installed versions is
 * listed once per version — with when Fleet first found it. Search and the
 * Discovered sort only; no severity, which the scanner does not rate.
 */
const softwareVulnerabilitiesTableQuery = graphql`
  query softwareVulnerabilitiesTableQuery(
    $softwareId: ID!
    $search: String
    $sort: SortInput
    $first: Int!
    $after: String
  ) {
    ...softwareVulnerabilitiesTable_query
      @arguments(softwareId: $softwareId, search: $search, sort: $sort, first: $first, after: $after)
  }
`;

const softwareVulnerabilitiesTableFragment = graphql`
  fragment softwareVulnerabilitiesTable_query on Query
  @refetchable(queryName: "softwareVulnerabilitiesTablePaginationQuery")
  @argumentDefinitions(
    softwareId: { type: "ID!" }
    search: { type: "String" }
    sort: { type: "SortInput" }
    first: { type: "Int", defaultValue: 20 }
    after: { type: "String" }
  ) {
    softwareVulnerabilities(softwareId: $softwareId, search: $search, sort: $sort, first: $first, after: $after)
      @connection(key: "softwareVulnerabilitiesTable_softwareVulnerabilities") {
      filteredCount
      edges {
        node {
          cveId
          # The other half of the row key: the same CVE comes once per
          # affected version, and the cell below reads it through its own
          # fragment.
          affectedVersion
          ...softwareVulnerabilityVersionCell_vulnerability
          ...softwareVulnerabilityDiscoveredCell_vulnerability
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

type SoftwareVulnerabilityRow = NonNullable<
  softwareVulnerabilitiesTable_query$data['softwareVulnerabilities']
>['edges'][number]['node'];

const COLUMNS: ColumnDef<SoftwareVulnerabilityRow>[] = [
  {
    id: SOFTWARE_VULNERABILITY_COLUMNS.cveId.id,
    header: SOFTWARE_VULNERABILITY_COLUMNS.cveId.header,
    cell: ({ row }: { row: Row<SoftwareVulnerabilityRow> }) => <TruncateText>{row.original.cveId}</TruncateText>,
    enableSorting: false,
    meta: liveColumnMeta(SOFTWARE_VULNERABILITY_COLUMNS.cveId),
  },
  {
    id: SOFTWARE_VULNERABILITY_COLUMNS.affectedVersion.id,
    header: SOFTWARE_VULNERABILITY_COLUMNS.affectedVersion.header,
    cell: ({ row }: { row: Row<SoftwareVulnerabilityRow> }) => (
      <SoftwareVulnerabilityVersionCell vulnerability={row.original} />
    ),
    enableSorting: false,
    meta: liveColumnMeta(SOFTWARE_VULNERABILITY_COLUMNS.affectedVersion),
  },
  {
    id: SOFTWARE_VULNERABILITY_COLUMNS.discoveredAt.id,
    header: SOFTWARE_VULNERABILITY_COLUMNS.discoveredAt.header,
    cell: ({ row }: { row: Row<SoftwareVulnerabilityRow> }) => (
      <SoftwareVulnerabilityDiscoveredCell vulnerability={row.original} />
    ),
    enableSorting: false,
    meta: liveColumnMeta(SOFTWARE_VULNERABILITY_COLUMNS.discoveredAt),
  },
  {
    id: SOFTWARE_VULNERABILITY_COLUMNS.open.id,
    cell: ({ row }: { row: Row<SoftwareVulnerabilityRow> }) => (
      <OpenRowButton label={`Open ${row.original.cveId} on NVD`} onClick={() => openNvd(row.original.cveId)} />
    ),
    enableSorting: false,
    meta: liveColumnMeta(SOFTWARE_VULNERABILITY_COLUMNS.open),
  },
];

/**
 * A row is a CVE on one affected version; the CVE id alone repeats. `\0` cannot
 * occur in either half, so the pair can't collide with another.
 */
const getRowId = (row: SoftwareVulnerabilityRow) => `${row.cveId}\0${row.affectedVersion ?? ''}`;

interface SoftwareVulnerabilitiesTableProps {
  softwareId: string;
  debouncedSearch: string;
  sort: SortInput | null;
  sortState: DataTableSortState | null;
  onSortChange: (columnId: string) => void;
  /** True while a refetch is in flight — guards the empty state so it never flashes on stale data. */
  isPending: boolean;
  /** Nothing matched to this title at all (not a search miss) — the tab drops its toolbar. */
  onEmptyChange: (isEmpty: boolean) => void;
  stickyHeaderOffset: string;
}

/** The Vulnerabilities tab's rows — suspends on the query, so it lives under the tab's `<Suspense>`. */
export function SoftwareVulnerabilitiesTable({
  softwareId,
  debouncedSearch,
  sort,
  sortState,
  onSortChange,
  isPending,
  onEmptyChange,
  stickyHeaderOffset,
}: SoftwareVulnerabilitiesTableProps) {
  const retryKey = useRetryKey();
  const queryData = useLazyLoadQuery<SoftwareVulnerabilitiesTableQueryType>(
    softwareVulnerabilitiesTableQuery,
    { softwareId, search: debouncedSearch || null, sort, first: SOFTWARE_VULNERABILITIES_PAGE_SIZE, after: null },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );

  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    SoftwareVulnerabilitiesTablePaginationQueryType,
    softwareVulnerabilitiesTable_query$key
  >(softwareVulnerabilitiesTableFragment, queryData);

  const rows = (data.softwareVulnerabilities?.edges ?? []).map(edge => edge.node);
  const totalCount = data.softwareVulnerabilities?.filteredCount ?? rows.length;

  const fetchNextPage = () => {
    if (hasNext && !isLoadingNext) loadNext(SOFTWARE_VULNERABILITIES_PAGE_SIZE);
  };

  const table = useDataTable<SoftwareVulnerabilityRow>({
    data: rows,
    columns: COLUMNS,
    getRowId,
    enableSorting: false,
  });

  // A search that finds nothing keeps the table (its own "no match" row); a
  // title with no CVEs at all gets the section's empty state instead.
  const showEmptyState = !debouncedSearch && !isPending && rows.length === 0;

  useEffect(() => {
    onEmptyChange(showEmptyState);
  }, [showEmptyState, onEmptyChange]);

  if (showEmptyState) {
    return (
      <EmptyState
        icon={<BracketSquareCheckIcon />}
        title="No known vulnerabilities"
        description="CVEs matched to this software will be listed here once the vulnerability scan reports them."
      />
    );
  }

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
          skeletonRows={SOFTWARE_VULNERABILITIES_PAGE_SIZE}
          emptyMessage={`No vulnerabilities found matching "${debouncedSearch}". Try adjusting your search.`}
          rowClassName="mb-1"
        />
        {/* Zero rows plus a next page: see vulnerability-list-table.tsx. */}
        {rows.length > 0 && (
          <DataTable.InfiniteFooter
            hasNextPage={hasNext}
            isFetchingNextPage={isLoadingNext}
            onLoadMore={fetchNextPage}
            skeletonRows={2}
          />
        )}
      </DataTable>
    </div>
  );
}
