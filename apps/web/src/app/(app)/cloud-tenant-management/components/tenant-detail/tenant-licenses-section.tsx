'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { Filter02Icon, InfoCircleIcon, SearchIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Button,
  type ColumnDef,
  FilterModal,
  Input,
  type Row,
  Tag,
  TruncateText,
  useDataTable,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useDebounce } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useMemo, useState } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type {
  DirectoryLicenseOrderInput,
  tenantLicensesSectionQuery as TenantLicensesSectionQueryType,
} from '@/__generated__/tenantLicensesSectionQuery.graphql';
import { NO_ITEMS, oneLineEmptyState, useRetryKey } from '@/app/components/shared';
import { LiveTable, loadingPlaceholderRows } from '@/app/components/shared/live-table';
import { liveColumnMeta, type TableSkeletonColumn } from '@/app/components/shared/table-column-layout';
import { useDeferredQuery } from '@/app/hooks/use-deferred-query';
import { DirectoryLicenseSortField, DirectoryProvider, SortDirection } from '@/generated/schema-enums';
import { TenantNotice } from './tenant-notice';

// Its own query: search and sort ask the server again, and the page's record should not wait for them. The snapshot of
// the last read, no provider call.
const tenantLicensesSectionQuery = graphql`
  query tenantLicensesSectionQuery($id: ID!, $search: String, $orderBy: DirectoryLicenseOrderInput) {
    directoryConnection(connectionId: $id) {
      licenseSummary {
        assigned
      }
      licenses(search: $search, orderBy: $orderBy) {
        id
        name
        assigned
        purchased
        unused
        free
      }
    }
  }
`;

/** A row as its cells read it; every field but `id` is absent on a loading row. */
interface LicenseRow {
  id: string;
  name?: string;
  free?: boolean;
  assigned?: string;
  unused?: number | null;
}

const LICENSE_COLUMNS = {
  license: { id: 'license', header: 'Licence', width: 'flex-1 min-w-0' },
  // A phone keeps the licence and what is assigned, the label under the number (Figma 3126-13528).
  assigned: { id: 'assigned', header: 'Assigned', width: 'w-24 shrink-0 content-md:w-48', sortable: true },
  unused: { id: 'unused', header: 'Unused', width: 'w-44 shrink-0', hideAt: 'md', sortable: true },
} satisfies Record<string, TableSkeletonColumn>;

const LICENSES_SKELETON_ROWS = 3;

const SORT_FIELDS = {
  [LICENSE_COLUMNS.assigned.id]: DirectoryLicenseSortField.ASSIGNED,
  [LICENSE_COLUMNS.unused.id]: DirectoryLicenseSortField.UNUSED,
};

type LicenseSort = { id: string; desc: boolean };

function toOrderBy(sort: LicenseSort | null): DirectoryLicenseOrderInput | null {
  if (!sort) return null;
  return { field: SORT_FIELDS[sort.id], direction: sort.desc ? SortDirection.DESC : SortDirection.ASC };
}

function LicenseCell({ row }: { row: LicenseRow }) {
  const loading = useLoadingScope();
  return (
    <div className="flex min-w-0 items-center gap-[var(--spacing-system-xsf)]">
      <TruncateText loading={loading}>{row.name ?? ''}</TruncateText>
      {row.free && <Tag data-loading-optional as="span" variant="grey" label="Free" className="shrink-0" />}
    </div>
  );
}

function AssignedCell({ row }: { row: LicenseRow }) {
  const loading = useLoadingScope();
  return (
    <div className="flex min-w-0 flex-col justify-center">
      <TruncateText loading={loading}>{row.assigned ?? ''}</TruncateText>
      <span className="text-ods-text-secondary text-h6 content-md:hidden">Assigned</span>
    </div>
  );
}

function licenseColumns(showUnused: boolean): ColumnDef<LicenseRow>[] {
  return [
    {
      id: LICENSE_COLUMNS.license.id,
      header: LICENSE_COLUMNS.license.header,
      cell: ({ row }: { row: Row<LicenseRow> }) => <LicenseCell row={row.original} />,
      enableSorting: false,
      meta: liveColumnMeta(LICENSE_COLUMNS.license),
    },
    {
      id: LICENSE_COLUMNS.assigned.id,
      header: LICENSE_COLUMNS.assigned.header,
      cell: ({ row }: { row: Row<LicenseRow> }) => <AssignedCell row={row.original} />,
      enableSorting: false,
      meta: liveColumnMeta(LICENSE_COLUMNS.assigned),
    },
    ...(showUnused
      ? [
          {
            id: LICENSE_COLUMNS.unused.id,
            header: LICENSE_COLUMNS.unused.header,
            cell: ({ row }: { row: Row<LicenseRow> }) => (
              <TruncateText loading={row.original.assigned === undefined}>
                {row.original.unused == null ? '—' : String(row.original.unused)}
              </TruncateText>
            ),
            enableSorting: false,
            meta: liveColumnMeta(LICENSE_COLUMNS.unused),
          },
        ]
      : []),
  ];
}

const getRowId = (row: LicenseRow) => row.id;

interface LicensesTableProps {
  id: string;
  /** The provider reports purchased seats: the Unused column, and "of N". */
  showUnused: boolean;
  /** Deferred sort and search: they feed the query. */
  orderBy: DirectoryLicenseOrderInput | null;
  search: string;
  /** Live sort: what the header draws, so a click lands instantly. */
  sort: LicenseSort | null;
  onSortChange: (columnId: string) => void;
  isPending: boolean;
}

function LicensesRows({
  rows,
  notRead,
  showUnused,
  search,
  sort,
  onSortChange,
  isPending,
}: LicensesTableProps & { rows: readonly LicenseRow[]; notRead: boolean }) {
  const loading = useLoadingScope();
  const placeholderRows = useMemo(
    () => (loading ? loadingPlaceholderRows<LicenseRow>(LICENSES_SKELETON_ROWS) : null),
    [loading],
  );
  const columns = useMemo(() => licenseColumns(showUnused), [showUnused]);
  const table = useDataTable<LicenseRow>({
    data: placeholderRows ?? (rows as LicenseRow[]),
    columns,
    getRowId,
    enableSorting: false,
  });
  const empty = search
    ? `No licences found matching "${search}". Try adjusting your search.`
    : notRead
      ? 'The licences have not been read yet.'
      : 'This directory holds no licences.';
  return (
    <LiveTable
      table={table}
      skeletonRows={LICENSES_SKELETON_ROWS}
      loadingCells={loading}
      stickyHeader={false}
      itemName="result"
      totalCount={rows.length}
      isPending={isPending}
      sort={sort}
      onSortChange={onSortChange}
      emptyState={oneLineEmptyState(empty)}
    />
  );
}

/** The rows, with their own boundary: the search above them stays live while they are read. */
function LicensesTable(props: LicensesTableProps) {
  return (
    <LoadingSuspense label="Loading licences">
      <LicensesTableReader {...props} />
    </LoadingSuspense>
  );
}

function LicensesTableReader(props: LicensesTableProps) {
  if (useLoadingScope()) return <LicensesRows {...props} rows={NO_ITEMS} notRead={false} />;
  return <LicensesTableQuery {...props} />;
}

function LicensesTableQuery(props: LicensesTableProps) {
  const { id, search, orderBy } = props;
  const retryKey = useRetryKey();
  const { directoryConnection } = useLazyLoadQuery<TenantLicensesSectionQueryType>(
    tenantLicensesSectionQuery,
    { id, search: search || null, orderBy },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );
  const licenses = directoryConnection?.licenses;
  const rows = useMemo<LicenseRow[]>(
    () =>
      (licenses ?? []).map(license => ({
        id: license.id,
        name: license.name,
        free: license.free,
        assigned: license.purchased == null ? String(license.assigned) : `${license.assigned} of ${license.purchased}`,
        unused: license.unused,
      })),
    [licenses],
  );
  // The page above has already said "not found" for a missing record.
  if (!directoryConnection) return null;
  return <LicensesRows {...props} rows={rows} notRead={directoryConnection.licenseSummary == null} />;
}

/**
 * "Licences" (Figma 3051-7925, Google 3065-17490 and 3126-13528): per SKU, searched and sorted by the server. Google
 * reports assignments only, so it says so and draws no Unused column.
 */
export function TenantLicensesSection({ id, provider }: { id: string; provider: string | null }) {
  const loading = useLoadingScope();
  const [input, setInput] = useState('');
  const search = useDebounce(input, 300).trim();
  const [sort, setSort] = useState<LicenseSort | null>(null);
  const [sortOpen, setSortOpen] = useState(false);
  // Memoized for its identity, not for speed: `useDeferredQuery` tells a pending refetch by comparing references.
  const orderBy = useMemo(() => toOrderBy(sort), [sort]);
  const { deferredFilters, deferredSearch, isPending } = useDeferredQuery(orderBy, search);
  const noTotals = provider === DirectoryProvider.GOOGLE_WORKSPACE;

  // Ascending, descending, then back to the order by name.
  const handleSortChange = (columnId: string) => {
    setSort(current => {
      if (current?.id !== columnId) return { id: columnId, desc: false };
      return current.desc ? null : { id: columnId, desc: true };
    });
  };

  return (
    <section className="flex flex-col gap-[var(--spacing-system-l)]">
      <h2 className="text-ods-text-primary text-h2">Licences</h2>
      {noTotals && (
        <TenantNotice data-loading-optional icon={<InfoCircleIcon size={24} />} title="Purchased total not available" />
      )}
      <div className="flex flex-col">
        <div className="flex items-center gap-[var(--spacing-system-m)]">
          <Input
            userValue
            placeholder="Search for Licence"
            value={input}
            onChange={event => setInput(event.target.value)}
            disabled={loading}
            aria-label="Search for Licence"
            className="flex-1"
            startAdornment={<SearchIcon className="h-4 w-4 content-md:h-6 content-md:w-6" />}
          />
          {/* The header sorts from `content-md`; a phone has no header (Figma 3126-13528). */}
          <Button
            variant="outline"
            size="icon"
            className="content-md:hidden"
            onClick={() => setSortOpen(true)}
            disabled={loading}
            aria-label="Sort licences"
            leftIcon={<Filter02Icon className="text-ods-text-primary" />}
          />
        </div>
        <LicensesTable
          id={id}
          showUnused={!noTotals}
          orderBy={deferredFilters}
          search={deferredSearch}
          sort={sort}
          onSortChange={handleSortChange}
          isPending={isPending}
        />
      </div>
      <FilterModal
        isOpen={sortOpen}
        onClose={() => setSortOpen(false)}
        title="Sort"
        filterGroups={[]}
        onFilterChange={() => setSort(null)}
        sortConfig={{
          columns: noTotals
            ? [{ key: LICENSE_COLUMNS.assigned.id, label: LICENSE_COLUMNS.assigned.header }]
            : [
                { key: LICENSE_COLUMNS.assigned.id, label: LICENSE_COLUMNS.assigned.header },
                { key: LICENSE_COLUMNS.unused.id, label: LICENSE_COLUMNS.unused.header },
              ],
          sortBy: sort?.id,
          sortDirection: sort?.desc ? 'desc' : 'asc',
        }}
        onSort={(id_, direction) => setSort({ id: id_, desc: direction === 'desc' })}
        onSortClear={() => setSort(null)}
      />
    </section>
  );
}
