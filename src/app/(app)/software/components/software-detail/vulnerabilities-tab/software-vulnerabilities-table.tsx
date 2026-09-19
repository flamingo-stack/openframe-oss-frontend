'use client';

import {
  type ColumnDef,
  DataTable,
  type DataTableSortState,
  type Row,
  TruncateText,
  useDataTable,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useLazyLoadQuery, usePaginationFragment } from 'react-relay';
import type {
  softwareVulnerabilitiesTable_query$data,
  softwareVulnerabilitiesTable_query$key,
} from '@/__generated__/softwareVulnerabilitiesTable_query.graphql';
import type { softwareVulnerabilitiesTablePaginationQuery as SoftwareVulnerabilitiesTablePaginationQueryType } from '@/__generated__/softwareVulnerabilitiesTablePaginationQuery.graphql';
import type {
  SoftwareVulnerabilityFilterInput,
  softwareVulnerabilitiesTableQuery as SoftwareVulnerabilitiesTableQueryType,
  SortInput,
} from '@/__generated__/softwareVulnerabilitiesTableQuery.graphql';
import { CVE_SEVERITY, CVE_SEVERITY_BANDS, liveColumnMeta, useRetryKey } from '@/app/components/shared';
import { multiSelectFilterFn } from '@/lib/table-filters';
import { openNvd } from '../../shared/nvd-url';
import { OpenRowButton } from '../../shared/open-row-button';
import { singleColumnFilter } from '../../shared/single-column-filter';
import { SOFTWARE_VULNERABILITIES_PAGE_SIZE, SOFTWARE_VULNERABILITY_COLUMNS } from './software-vulnerabilities-columns';
import { SoftwareVulnerabilityPublishedCell } from './software-vulnerability-published-cell';
import { SoftwareVulnerabilitySeverityCell } from './software-vulnerability-severity-cell';
import { SoftwareVulnerabilityVersionCell } from './software-vulnerability-version-cell';

/**
 * Software → Vulnerabilities: the CVEs matched to this title. One row per CVE,
 * with the fleet version it affects and when it was published.
 */
const softwareVulnerabilitiesTableQuery = graphql`
  query softwareVulnerabilitiesTableQuery(
    $softwareId: ID!
    $filter: SoftwareVulnerabilityFilterInput
    $search: String
    $sort: SortInput
    $first: Int!
    $after: String
  ) {
    ...softwareVulnerabilitiesTable_query
      @arguments(softwareId: $softwareId, filter: $filter, search: $search, sort: $sort, first: $first, after: $after)
  }
`;

const softwareVulnerabilitiesTableFragment = graphql`
  fragment softwareVulnerabilitiesTable_query on Query
  @refetchable(queryName: "softwareVulnerabilitiesTablePaginationQuery")
  @argumentDefinitions(
    softwareId: { type: "ID!" }
    filter: { type: "SoftwareVulnerabilityFilterInput" }
    search: { type: "String" }
    sort: { type: "SortInput" }
    first: { type: "Int", defaultValue: 20 }
    after: { type: "String" }
  ) {
    softwareVulnerabilities(
      softwareId: $softwareId
      filter: $filter
      search: $search
      sort: $sort
      first: $first
      after: $after
    ) @connection(key: "softwareVulnerabilitiesTable_softwareVulnerabilities") {
      filteredCount
      edges {
        node {
          cveId
          # What the severity funnel narrows the rows on screen by, while the
          # refetch it triggered is still in flight.
          severity
          ...softwareVulnerabilitySeverityCell_vulnerability
          ...softwareVulnerabilityVersionCell_vulnerability
          ...softwareVulnerabilityPublishedCell_vulnerability
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

/** Severity funnel options, highest band first. */
const SEVERITY_OPTIONS = CVE_SEVERITY_BANDS.map(band => ({ id: band, label: CVE_SEVERITY[band].label, value: band }));

const COLUMNS: ColumnDef<SoftwareVulnerabilityRow>[] = [
  {
    id: SOFTWARE_VULNERABILITY_COLUMNS.cveId.id,
    header: SOFTWARE_VULNERABILITY_COLUMNS.cveId.header,
    cell: ({ row }: { row: Row<SoftwareVulnerabilityRow> }) => <TruncateText>{row.original.cveId}</TruncateText>,
    enableSorting: false,
    meta: liveColumnMeta(SOFTWARE_VULNERABILITY_COLUMNS.cveId),
  },
  {
    id: SOFTWARE_VULNERABILITY_COLUMNS.severity.id,
    header: SOFTWARE_VULNERABILITY_COLUMNS.severity.header,
    accessorFn: (row: SoftwareVulnerabilityRow) => row.severity ?? '',
    cell: ({ row }: { row: Row<SoftwareVulnerabilityRow> }) => (
      <SoftwareVulnerabilitySeverityCell vulnerability={row.original} />
    ),
    enableSorting: false,
    filterFn: multiSelectFilterFn,
    meta: liveColumnMeta(SOFTWARE_VULNERABILITY_COLUMNS.severity, { filter: { options: SEVERITY_OPTIONS } }),
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
    id: SOFTWARE_VULNERABILITY_COLUMNS.publishedAt.id,
    header: SOFTWARE_VULNERABILITY_COLUMNS.publishedAt.header,
    cell: ({ row }: { row: Row<SoftwareVulnerabilityRow> }) => (
      <SoftwareVulnerabilityPublishedCell vulnerability={row.original} />
    ),
    enableSorting: false,
    meta: liveColumnMeta(SOFTWARE_VULNERABILITY_COLUMNS.publishedAt),
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

const getRowId = (row: SoftwareVulnerabilityRow) => row.cveId;

interface SoftwareVulnerabilitiesTableProps {
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

/** The Vulnerabilities tab's rows — suspends on the query, so it lives under the tab's `<Suspense>`. */
export function SoftwareVulnerabilitiesTable({
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
}: SoftwareVulnerabilitiesTableProps) {
  const retryKey = useRetryKey();
  const queryData = useLazyLoadQuery<SoftwareVulnerabilitiesTableQueryType>(
    softwareVulnerabilitiesTableQuery,
    {
      softwareId,
      filter: backendFilters,
      search: debouncedSearch || null,
      sort,
      first: SOFTWARE_VULNERABILITIES_PAGE_SIZE,
      after: null,
    },
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

  const { columnFilters, onColumnFiltersChange } = singleColumnFilter(
    SOFTWARE_VULNERABILITY_COLUMNS.severity.id,
    severityFilter,
    onSeverityFilterChange,
  );

  const table = useDataTable<SoftwareVulnerabilityRow>({
    data: rows,
    columns: COLUMNS,
    getRowId,
    enableSorting: false,
    state: { columnFilters },
    onColumnFiltersChange,
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
          skeletonRows={SOFTWARE_VULNERABILITIES_PAGE_SIZE}
          emptyMessage={
            debouncedSearch
              ? `No vulnerabilities found matching "${debouncedSearch}". Try adjusting your search.`
              : backendFilters
                ? 'No vulnerabilities at the selected severity. Try adjusting your filter.'
                : 'No known vulnerabilities for this software.'
          }
          rowClassName="mb-1"
          autoHeight
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
